import type { Unidad } from '@prisma/client'

/**
 * Los productos tal como estaban en el componente original, en su orden exacto.
 *
 * El orden importa: el boton "copiar columnas" pega compra y venta en dos columnas
 * de la hoja de calculo, fila por fila. Si este orden cambia, la hoja se desalinea.
 *
 * El margen no estaba escrito en ninguna parte: se derivaba con venta/compra y caia
 * a 1.3 cuando faltaba alguno de los dos. El seed hace exactamente lo mismo.
 */
export interface FilaBase {
  nombre: string
  unidad: Unidad | null
  compra: number | null
  venta: number | null
}

type Cruda = [string, string, number | null, number | null]

const CRUDAS: Cruda[] = [
  ['Brócoli', 'Kg', 1666.67, 2167],
  ['Apio', 'Kg', 3000, 3900],
  ['Raíces china', 'Kg', 4000, 5200],
  ['Espinaca', 'Kg', 2000, 2600],
  ['Cilantro', 'Kg', 15000, 19500],
  ['Aromáticas', '', null, 500],
  ['Tomillo y laurel', '', null, null],
  ['Aguacate', 'Kg', 9500, 12350],
  ['Arracacha', 'Kg', 6000, 7800],
  ['Lechuga', 'Kg', 2000, 2600],
  ['Champiñones', '', null, null],
  ['Tomate de árbol', 'Kg', 4000, 5200],
  ['Mazorca (tusa)', 'Kg', 8000, 10400],
  ['Mazorca desgranada', 'Kg', null, null],
  ['Cebolla larga', 'Kg', 3600, 4680],
  ['Fresa', 'Lb', 7000, 9100],
  ['Mora', 'Lb', 7000, 9100],
  ['Lulo', 'Kg', 4800, 6240],
  ['Banano verde', 'Kg', 2300, 2990],
  ['Manzana verde', 'C/u', 1600, 2100],
  ['Manzana roja', 'C/u', 1600, 2100],
  ['Naranja', 'Kg', 4200, 5460],
  ['Granadilla', 'C/u', 1666, 2200],
  ['Durazno', 'Kg', 7000, 9100],
  ['Melón', 'Kg', 4000, 5200],
  ['Maracuyá', 'Kg', 6000, 7800],
  ['Guayaba', 'Kg', 3000, 3900],
  ['Curuba', 'Kg', 4000, 4800],
  ['Pera', 'Kg', 2600, 3380],
  ['Papaya', 'Lb', 6400, 8320],
  ['Mango tommy', 'Kg', 4600, 5980],
  ['Mango azúcar', 'Kg', 5000, 6500],
  ['Piña', 'Kg', 4000, 5200],
  ['Mandarina', 'Kg', 5200, 6760],
  ['Kiwi', 'Kg', 16000, 20800],
  ['Arándanos', 'Kg', 6500, 7800],
  ['Pitaya', 'Kg', 14000, 18200],
  ['Uva isabelina', 'C/u', 2500, 3500],
  ['Guanábana', 'Kg', 5500, 7150],
  ['Yuca', 'Kg', 2000, 2600],
  ['Tomate parejo', 'Kg', 2500, 3250],
  ['Tomate grueso', 'Kg', 4500, 5850],
  ['Pimentón', 'Kg', 4500, 5850],
  ['Cohombro', 'Kg', 3000, 3900],
  ['Pepino guiso', 'Kg', 3000, 3900],
  ['Guatila', 'Kg', 2500, 3250],
  ['Coliseros', 'Kg', 2200, 3200],
  ['Plátano maduro', 'Kg', 2500, 3250],
  ['Plátano verde', 'Kg', 2000, 2600],
  ['Plátano parejo', 'Kg', 1800, 2340],
  ['Fríjol', 'Kg', 6000, 7800],
  ['Ahuyama', 'Kg', 2200, 2860],
  ['Ahuyama zapallo', 'Kg', null, null],
  ['Limón', 'Kg', 5600, 7280],
  ['Habichuela', 'Kg', 4000, 5000],
  ['Alverja', 'Kg', 8400, 10500],
  ['Alverja desgranada', 'Lb', 17000, 18500],
  ['Cebolla cabezona pareja', 'Kg', 2800, 3640],
  ['Cebolla roja', 'Kg', 3000, 3900],
  ['Rábano', 'Kg', null, null],
  ['Papa (bulto)', 'Bulto', 125000, null],
  ['Papa lavada', 'Kg', 1800, 2340],
  ['Papa sabanera', 'Kg', 4000, 5200],
  ['Criolla pareja', 'Kg', 4800, 6240],
  ['Criolla', 'Kg', 7200, 9360],
  ['Remolacha', 'Kg', 2000, 2600],
  ['Zanahoria', 'Kg', 2400, 3120],
  ['Cubios', 'C/u', null, null],
  ['Habas', 'C/u', 2500, 3250],
  ['Chuguas', 'C/u', 1000, 1300],
  ['Jengibre', 'Kg', 10000, 13000],
  ['Ají tarro', 'C/u', null, null],
  ['Ajo morado', 'C/u', null, 1500],
  ['Jabón rey', 'C/u', 2840, 3500],
  ['Café Águila Roja papeleta', 'C/u', 2140, 2600],
  ['Café Águila Roja 1/4', 'C/u', 6500, 7800],
  ['Vasos 5 oz', 'C/u', 1850, 2300],
  ['Vasos 7 oz', 'C/u', null, null],
  ['Copas ají', 'Paquete', 1700, 2100],
  ['Aluminio', 'C/u', 2800, 3400],
  ['Bolsas', 'Paquete', null, null],
  ['Plato mediano', '', null, null],
  ['Plato grande', '', null, null],
  ['Plato ponqué', '', null, null],
  ['Plato hondo', '', null, null],
  ['Miel', '', null, null],
  ['Arroz Roa', '', null, null],
  ['Arroz Diana', '', null, null],
  ['Sello rojo', '', null, null],
  ['Águila roja', '', null, null],
  ['Florhuila', '', null, null],
  ['Arroz con fideos', '', null, null],
  ['Boluga', '', null, null],
  ['Donkat', '', null, null],
  ['Veladoras', '', null, null],
  ['Guantes de manipulación', '', null, null],
  ['Harina Pan libra', '', null, null],
  ['Panela pequeña', '', null, null],
  ['Agua con gas', '', null, null],
  ['Icopores', '', null, null],
  ['Panelada', '', null, null],
  ['Bastilla', '', null, null],
  ['Masa para buñuelos', '', null, null],
  ['Colcafé', '', null, null],
  ['Jumbo', '', null, null],
  ['Sello rojo papeleta', '', null, null],
  ['Chocolatina Jet', '', null, null],
  ['Ricostilla', '', null, null],
  ['Maggi', '', null, null],
  ['Rica pasta', '', null, null],
  ['Milo', '', null, null],
  ['Maggi bases de pollo', '', null, null],
]

const UNIDADES: Record<string, Unidad | null> = {
  Kg: 'KG',
  Lb: 'LB',
  'C/u': 'UNIDAD',
  Paquete: 'PAQUETE',
  Bulto: 'BULTO',
  '': null,
}

export const PRODUCTOS: FilaBase[] = CRUDAS.map(([nombre, unidad, compra, venta]) => ({
  nombre,
  unidad: UNIDADES[unidad] ?? null,
  // Un solo costo venia con decimales (Brócoli, 1666.67). Los pesos no tienen
  // centavos y el redondeo a 50 se come la diferencia.
  compra: compra == null ? null : Math.round(compra),
  venta,
}))
