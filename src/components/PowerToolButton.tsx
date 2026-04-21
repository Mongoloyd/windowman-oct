import React from "react";

interface PowerToolButtonProps {
  onClick?: () => void;
}

const PowerToolButton: React.FC<PowerToolButtonProps> = ({ onClick }) => (
  <button
    onClick={onClick}
    className="btn-depth-destructive w-full sm:w-auto whitespace-nowrap"
    style={{ fontSize: 18, padding: "20px 40px" }}
  >
    No Quote Yet? Start Here
  </button>
);

export default PowerToolButton;
