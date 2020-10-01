    /**
    * Properties of a grid cell polygon.
    */
   export interface CellInfo {
    /** A unique ID for the cluster that can be used with the GriddedDataSource getCellChildren methods. */
    cell_id: string;

    /* The number of pounts in the cell. */
    point_count: number;

    /* A string that abbreviates the point_count value if it's long. (for example, 4,000 becomes 4K) */
    point_count_abbreviated: string;

    /** The calculated aggregate values. */
    aggregateProperties: Record<string, number | boolean>;

    /* Private Properties */

    /* The x position of the cell in pixels at zoom level 22. For most grids this is the center of the cell, for the a triangle grid is the top left or bottom left corner depending on orientation. */
    _x: number;

    /* The y position of the cell in pixels at zoom level 22. For most grids this is the center of the cell, for the a triangle grid is the top left or bottom left corner depending on orientation. */
    _y: number;

    /** If representing a triangle, this property indictates if the it is pointing up or down. */
    _rightSideUp?: boolean;
}