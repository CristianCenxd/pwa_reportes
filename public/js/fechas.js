const FORMATO_FECHA = /^\d{4}-\d{2}-\d{2}$/;

export function fechaHoyLocal() {
  const hoy = new Date();
  const anio = hoy.getFullYear();
  const mes = String(hoy.getMonth() + 1).padStart(2, '0');
  const dia = String(hoy.getDate()).padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
}

export function tieneFormatoFecha(valor) {
  return typeof valor === 'string' && FORMATO_FECHA.test(valor);
}

export function esFechaCalendarioValida(valor) {
  if (!tieneFormatoFecha(valor)) {
    return false;
  }

  const [anioTexto, mesTexto, diaTexto] = valor.split('-');
  const anio = Number(anioTexto);
  const mes = Number(mesTexto);
  const dia = Number(diaTexto);

  if (anio < 1 || mes < 1 || mes > 12 || dia < 1 || dia > 31) {
    return false;
  }

  const fecha = new Date(Date.UTC(2000, mes - 1, dia));
  fecha.setUTCFullYear(anio);

  return fecha.getUTCFullYear() === anio
    && fecha.getUTCMonth() === mes - 1
    && fecha.getUTCDate() === dia;
}
