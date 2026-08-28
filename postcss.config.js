import autoprefixer from "autoprefixer";
import tailwindcss from "tailwindcss";

const preserveGeneratedSourceMetadata = {
  postcssPlugin: "preserve-generated-source-metadata",
  Once(root) {
    root.walkDecls((declaration) => {
      if (!declaration.source?.input.file && declaration.parent?.source?.input.file) {
        declaration.source = declaration.parent.source;
      }
    });
  },
};

export default {
  plugins: [tailwindcss(), autoprefixer(), preserveGeneratedSourceMetadata],
};
