export type QualifiedContact = {
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
};

export type CrmDeliveryResult =
  | { ok: true; contactId: string; status: number }
  | { ok: false; code: string; status: number | null; retryable: boolean };

export interface CrmAdapter {
  upsertQualifiedContact(
    locationId: string,
    contact: QualifiedContact,
  ): Promise<CrmDeliveryResult>;
}

export function createGhlAdapter(
  token: string,
  fetchImpl: typeof fetch = fetch,
): CrmAdapter {
  return {
    async upsertQualifiedContact(locationId, contact) {
      if (!token || !locationId || (!contact.email && !contact.phone)) {
        return {
          ok: false,
          code: "ghl_invalid_config_or_identity",
          status: null,
          retryable: false,
        };
      }
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);
      let response: Response;
      try {
        response = await fetchImpl(
          "https://services.leadconnectorhq.com/contacts/upsert",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              Version: "2023-02-21",
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify({
              locationId,
              firstName: contact.firstName,
              lastName: contact.lastName,
              email: contact.email,
              phone: contact.phone,
              source: "WindowMan qualified Meta lead",
              createNewIfDuplicateAllowed: false,
            }),
            signal: controller.signal,
          },
        );
      } catch (_error) {
        return {
          ok: false,
          code: "ghl_network_error",
          status: null,
          retryable: true,
        };
      } finally {
        clearTimeout(timeout);
      }
      if (!response.ok) {
        return {
          ok: false,
          code: response.status === 429 ? "ghl_rate_limited" : "ghl_rejected",
          status: response.status,
          retryable: response.status === 408 || response.status === 429 ||
            response.status >= 500,
        };
      }
      let raw: unknown;
      try {
        raw = await response.json();
      } catch (_error) {
        return {
          ok: false,
          code: "ghl_invalid_response",
          status: response.status,
          retryable: true,
        };
      }
      const data = raw && typeof raw === "object"
        ? raw as Record<string, unknown>
        : null;
      const contactRow = data?.contact && typeof data.contact === "object"
        ? data.contact as Record<string, unknown>
        : null;
      const contactId = typeof contactRow?.id === "string"
        ? contactRow.id.trim()
        : "";
      if (!contactId || contactRow?.locationId !== locationId) {
        return {
          ok: false,
          code: "ghl_contact_mismatch",
          status: response.status,
          retryable: false,
        };
      }
      return { ok: true, contactId, status: response.status };
    },
  };
}
