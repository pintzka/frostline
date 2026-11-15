// JSON-filer importeres som «ukjent» data. Parkfilene sjekkes med validatePark før de brukes.
declare module '*.json' {
  const value: unknown;
  export default value;
}
