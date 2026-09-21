// Test fixtures para OCR - albaranes anonimizados
// Cada fixture: { input: texto OCR simulado, expected: { address, items } }

export const ocrFixtures = [
  {
    name: "albaran-basico",
    input: `ALBARÁN DE ENTREGA
Nº 001234
Fecha: 15/01/2024

CLIENTE: Juan Pérez
DIRECCIÓN: Calle Mayor 45, 46001 Valencia

PRODUCTOS:
1 x Cajas de vino tinto
2 x Botellas de aceite
Total: 3 bultos`,
    expected: {
      address: "Calle Mayor 45, 46001 Valencia",
      items: [
        { name: "Cajas de vino tinto", qty: 1 },
        { name: "Botellas de aceite", qty: 2 }
      ]
    }
  },
  {
    name: "albaran-tabla",
    input: `ALBARÁN Nº 5678
CLIENTE: María García
Calle de la Paz 12, 46003 Valencia

Nº  CODIGO  PRODUCTO                    CANT
1   VIN-001 Vino tinto crianza 75cl       6
2   ACE-002 Aceite oliva virgen 1L        4
3   QUES-03 Queso manchego curado         2
TOTAL                                    12`,
    expected: {
      address: "Calle de la Paz 12, 46003 Valencia",
      items: [
        { name: "Vino tinto crianza 75cl", qty: 6 },
        { name: "Aceite oliva virgen 1L", qty: 4 },
        { name: "Queso manchego curado", qty: 2 }
      ]
    }
  },
  {
    name: "albaran-puntos",
    input: `REPARTO URGENTE
Almacén: Valencia Centro
Destino: Avenida del Puerto 200, 46024 Valencia

Productos ................. Cantidad
Cajas de cerveza .......... 10
Botellas de agua ........... 24
Pack de refrescos .......... 6`,
    expected: {
      address: "Avenida del Puerto 200, 46024 Valencia",
      items: [
        { name: "Cajas de cerveza", qty: 10 },
        { name: "Botellas de agua", qty: 24 },
        { name: "Pack de refrescos", qty: 6 }
      ]
    }
  },
  {
    name: "albaran-calle-bultos",
    input: `ENTREGA
Dirección: Calle de los Bultos 33, 46005 Valencia
Cliente: Restaurante El Puerto

2 x Cajas de marisco
1 x Palet de hielo`,
    expected: {
      address: "Calle de los Bultos 33, 46005 Valencia",
      items: [
        { name: "Cajas de marisco", qty: 2 },
        { name: "Palet de hielo", qty: 1 }
      ]
    }
  },
  {
    name: "albaran-avenda",
    input: `ALBARÁN DE REPARTO
Nº 98765
Avenida de Aragón 15, 46007 Valencia

Productos:
5 Cajas de vino blanco
3 Botellas de vermut
Total bultos: 8`,
    expected: {
      address: "Avenida de Aragón 15, 46007 Valencia",
      items: [
        { name: "Cajas de vino blanco", qty: 5 },
        { name: "Botellas de vermut", qty: 3 }
      ]
    }
  },
  {
    name: "albaran-plaza",
    input: `HOJA DE REPARTO
Plaza del Ayuntamiento 1, 46002 Valencia

Cajas de embutidos ...... 4
Botellas de vino .......... 12
Quesos variados ........... 3`,
    expected: {
      address: "Plaza del Ayuntamiento 1, 46002 Valencia",
      items: [
        { name: "Cajas de embutidos", qty: 4 },
        { name: "Botellas de vino", qty: 12 },
        { name: "Quesos variados", qty: 3 }
      ]
    }
  },
  {
    name: "albaran-ronda",
    input: `REPARTO EXPRESS
Ronda Norte 88, 46015 Valencia

1 Palet de refrescos
6 Cajas de cerveza
4 Botellas de zumo`,
    expected: {
      address: "Ronda Norte 88, 46015 Valencia",
      items: [
        { name: "Palet de refrescos", qty: 1 },
        { name: "Cajas de cerveza", qty: 6 },
        { name: "Botellas de zumo", qty: 4 }
      ]
    }
  },
  {
    name: "albaran-carretera",
    input: `ALBARÁN
Carretera de Madrid km 12, 46014 Valencia

10 Cajas de agua mineral
5 Packs de refrescos`,
    expected: {
      address: "Carretera de Madrid km 12, 46014 Valencia",
      items: [
        { name: "Cajas de agua mineral", qty: 10 },
        { name: "Packs de refrescos", qty: 5 }
      ]
    }
  },
  {
    name: "albaran-poligono",
    input: `ENTREGA INDUSTRIAL
Polígono Industrial El Pla 45, 46013 Valencia

20 Cajas de tornillos
15 Bolsas de tuercas
5 Cajas de arandelas`,
    expected: {
      address: "Polígono Industrial El Pla 45, 46013 Valencia",
      items: [
        { name: "Cajas de tornillos", qty: 20 },
        { name: "Bolsas de tuercas", qty: 15 },
        { name: "Cajas de arandelas", qty: 5 }
      ]
    }
  },
  {
    name: "albaran-urbanizacion",
    input: `REPARTO DOMICILIO
Urbanización Los Pinos 22, 46012 Valencia

3 Cajas de frutas
5 Bolsas de verduras
2 Botellas de aceite`,
    expected: {
      address: "Urbanización Los Pinos 22, 46012 Valencia",
      items: [
        { name: "Cajas de frutas", qty: 3 },
        { name: "Bolsas de verduras", qty: 5 },
        { name: "Botellas de aceite", qty: 2 }
      ]
    }
  },
  {
    name: "albaran-sin-items",
    input: `ALBARÁN
Calle San Vicente 100, 46008 Valencia
Cliente: Tienda de barrio
Sin productos detallados`,
    expected: {
      address: "Calle San Vicente 100, 46008 Valencia",
      items: []
    }
  },
  {
    name: "albaran-cp-solo",
    input: `ENTREGA
46006 Valencia
Cliente: Supermercado Central

15 Cajas de leche
20 Packs de yogures`,
    expected: {
      address: "46006 Valencia",
      items: [
        { name: "Cajas de leche", qty: 15 },
        { name: "Packs de yogures", qty: 20 }
      ]
    }
  },
  {
    name: "albaran-direccion-corta",
    input: `REPARTO
Mayor 12 M, 46001 Valencia

3 Cajas de pan
2 Barras de pan`,
    expected: {
      address: "Mayor 12 M, 46001 Valencia",
      items: [
        { name: "Cajas de pan", qty: 3 },
        { name: "Barras de pan", qty: 2 }
      ]
    }
  },
  {
    name: "albaran-con-parentesis",
    input: `ALBARÁN
Calle de la Luna 5, 46001 Valencia (El Carmen)

4 Cajas de quesos
3 Botellas de vino`,
    expected: {
      address: "Calle de la Luna 5, 46001 Valencia",
      items: [
        { name: "Cajas de quesos", qty: 4 },
        { name: "Botellas de vino", qty: 3 }
      ]
    }
  },
  {
    name: "albaran-prefijo-numero",
    input: `1       Calle del Mar 20, 46011 Valencia
2 x Cajas de pescado
1 x Caja de marisco congelado`,
    expected: {
      address: "Calle del Mar 20, 46011 Valencia",
      items: [
        { name: "Cajas de pescado", qty: 2 },
        { name: "Caja de marisco congelado", qty: 1 }
      ]
    }
  },
  {
    name: "albaran-x-minuscula",
    input: `REPARTO
Calle del Sol 8, 46009 Valencia

3x Cajas de refrescos
2x Botellas de agua`,
    expected: {
      address: "Calle del Sol 8, 46009 Valencia",
      items: [
        { name: "Cajas de refrescos", qty: 3 },
        { name: "Botellas de agua", qty: 2 }
      ]
    }
  },
  {
    name: "albaran-cantidad-final",
    input: `ENTREGA
Avenida Blasco Ibáñez 40, 46021 Valencia

Cajas de naranjas ............ 20
Botellas de zumo natural ...... 15`,
    expected: {
      address: "Avenida Blasco Ibáñez 40, 46021 Valencia",
      items: [
        { name: "Cajas de naranjas", qty: 20 },
        { name: "Botellas de zumo natural", qty: 15 }
      ]
    }
  },
  {
    name: "albaran-simbolos-tabla",
    input: `ALBARÁN
| Calle | Número | CP | Ciudad |
| Gran Vía | 15 | 46001 | Valencia |
| | | | |
Productos:
| 3 | Cajas de vino | 6€ | 18€ |
| 2 | Botellas aceite | 4€ | 8€ |`,
    expected: {
      address: "Gran Vía 15, 46001 Valencia",
      items: [
        { name: "Cajas de vino", qty: 3 },
        { name: "Botellas aceite", qty: 2 }
      ]
    }
  },
  {
    name: "albaran-calle-corta",
    input: `REPARTO
C/ Mayor 5, 46001 Valencia

1 Caja de libros
2 Cajas de papeles`,
    expected: {
      address: "C/ Mayor 5, 46001 Valencia",
      items: [
        { name: "Caja de libros", qty: 1 },
        { name: "Cajas de papeles", qty: 2 }
      ]
    }
  },
  {
    name: "albaran-carratera",
    input: `ENTREGA
Ctra. Valencia-Barcelona km 5, 46013 Valencia

10 Cajas de cemento
5 Bolsas de arena`,
    expected: {
      address: "Ctra. Valencia-Barcelona km 5, 46013 Valencia",
      items: [
        { name: "Cajas de cemento", qty: 10 },
        { name: "Bolsas de arena", qty: 5 }
      ]
    }
  }
];

export default ocrFixtures;