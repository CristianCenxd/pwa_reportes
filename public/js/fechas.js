const FORMATO_FECHA = /^\d{4}-\d{2}-\d{2}$/;

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
