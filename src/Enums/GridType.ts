/**
* Specifies how data is rendered wintin a grid system.
*/
export enum GridType {
    /* Renders data within a square grid as circles. */
    circle = 'circle',

    /* Renders data within a hexagons grid. */
    hexagon = 'hexagon',

    /* Renders data within a hexagon grid as circles. */
    hexCircle = 'hexCircle',

    /* Renders data within a rotate hexagon grid. */
    pointyHexagon = 'pointyHexagon',

    /* Renders data within a square grid. */
    square = 'square',

    /** Renders data within a triangular grid. */
    triangle = 'triangle'
}