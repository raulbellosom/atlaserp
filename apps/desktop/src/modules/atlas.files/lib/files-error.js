export function filesError(error) {
  try {
    return (
      JSON.parse(error.message).error || "No se pudo completar la operación."
    );
  } catch {
    return "No se pudo completar la operación.";
  }
}
