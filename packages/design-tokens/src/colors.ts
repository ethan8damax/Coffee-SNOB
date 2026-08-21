export const colors = {
  sage: "#9cb6b8",
  sageDk: "#86a4a6",
  sageLt: "#b6c9ca",
  oxblood: "#4a1206",
  oxbloodLt: "#63200e",
  burnt: "#c46a17",
  teal: "#0e8ba3",
  tealDk: "#0a6272",
  cream: "#e9e4d0",
  paper: "#f0ecdf",
  paper2: "#e6e1d1",
  card: "#faf8ef",
  ink: "#161310",
  ink2: "#4b423a",
  ink3: "#8c8175",
  rule: "rgba(22,19,16,.13)",
  rule2: "rgba(22,19,16,.07)",
} as const;

export type ColorToken = keyof typeof colors;
