import * as azmaps from 'azure-maps-control';
import { CellInfo } from './CellInfo';
import { GridType } from '../Enums/GridType';
import { GriddedDataSourceOptions } from '../source/GriddedDataSource';
import { CellAggregateExpression as AggregateExpression, Expression } from './Expressions';
import { ScaleRange } from './ScaleRange';

/** Details about a grid system and the data points within. */
export interface GridInfo {

    /** The polygon bins for the grid. */
    cells: azmaps.data.Feature<azmaps.data.Polygon, CellInfo>[];

    /**  A lookup table of cell_id values to array index of bins. */
    cellLookupTable: Record<string, number>;

    /** A lookup table of cell_id values to array index of source points. */
    pointLookupTable: Record<string, number[]>;

    /** Scale metrics for the data set. */
    scaleMetrics?: ScaleRange;

    /** Width of cells. */
    width: number;

    /** Height of cells. */
    height: number;
}

/** An object that caches of arc angle calculations. */
interface ArcAngles {
    /** Math.sin((i * 360 / numNodes + offset) * Math.PI / 180) */
    sin : number[];

    /** Math.cos((i * 360 / numNodes + offset) * Math.PI / 180) */
    cos: number[];
}

/** A three paramter coordinate object. */
interface CubeCoord {
    /** The x cell position on a grid system. */
    col: number;

    /** The y cell position on a grid system. */
    row: number;

    /** The z cell position on a grid system. Only used for cubic coordinate systems such as Hexagon grid.  */
    z: number;
}

/** A static class of grid based calculations. */
export class GridMath {
    
    /**
     * Aggregates points into a grid system.
     * @param points Points to aggregate.
     * @param pixels Pixels values for the points at zoom level 22. Precalculating and storing this help with updates when grid options changes but the points don't.
     * @param options Options for the grid system.
     */
    public static calculateGrid(points: azmaps.data.Feature<azmaps.data.Point, any>[], pixels: azmaps.Pixel[], options: GriddedDataSourceOptions): GridInfo {
        const self = this;

        //Combine options with defaults.
        options = Object.assign({
            gridType: 'hexagon',
            cellWidth: 25000,
            distanceUnits: 'meters',
            coverage: 1,
            minCellWidth: 0,            
            scaleExpression: self.LinearPointCountScaleExpression
        }, options || {});

        points = points || [];

        //centerLatitude

        /* The pixel width of the cell to create. This is the spatial distance, converted to a pixel distance at the centerLatitude and zoom level 22. */
        const groundResolution = self._getGroundResolutionZ22(options.centerLatitude);
        let width = azmaps.math.convertDistance(options.cellWidth, options.distanceUnits, 'meters') / groundResolution;  
        let minCellWidth = azmaps.math.convertDistance(Math.min(options.minCellWidth, options.cellWidth), options.distanceUnits, 'meters') / groundResolution;       

        //Determine if there are aggregate expressions to calculate.
        const hasAggregates = options.aggregateProperties && Object.keys(options.aggregateProperties).length > 0;

        //Parse the map expressions for aggregates.
        const mapExpressions = (hasAggregates)? self._parseMapExpressions(options.aggregateProperties): {};

        //Parse the scale expression.
        const scaleExpression = Expression.parse(options.scaleExpression || self.LinearPointCountScaleExpression);

        //Precalculate arc angle values for cell polygon generation.
        let arcAngles: ArcAngles = self._getArcAngles(options.gridType);
        
        const sqrt3 = Math.sqrt(3);

        let height: number;

        switch (options.gridType) {
            case 'pointyHexagon': 
                height = 2 * width / sqrt3;
                break;
            case 'hexagon':
            case 'hexCircle':             
                height = sqrt3 * width * 0.5;
                break;
            case 'triangle':                
                height = sqrt3 * 0.5 * width;
                break;
            default:
                //Square grid system used. 
                height = width;
                break;
        }
        
        //Initialized grid info.
        const gridInfo: GridInfo = {
            cells: [],
            cellLookupTable: {},
            pointLookupTable: {},
            width: width,
            height: height
        };

        //Calculated cubic coordinate.
        let coord: CubeCoord = { col:0, row:0, z:0 };

        //Loop through the array of points and sort them into their respective bins.
        for(let i = 0, len = points.length; i < len; i++) {
            //Calculate the pixel location of a point at zoom level 22. 
            let pixel = pixels[i];    
            
            //Calculate the cubic coordinate for the data bin that contains the points pixel coordinate.
            self._getCellCoord(pixel, width, height, options.gridType, coord, sqrt3);
            
            //Create a unique id for the bin using the x, y and z, parameters of the cubic coordinate.
            let cellId = `x${coord.col}y${coord.row}z${coord.z}`; 

            let cell = self._getGridCell(cellId, coord, i, gridInfo, width, height, options.gridType, hasAggregates);

            //Calculate aggregates and metrics for cell.
            self._incrementCellInfo(cell.properties, points[i], options.aggregateProperties, mapExpressions);
        }
        
        self._finalizeGrid(gridInfo, width, height, options, mapExpressions, scaleExpression, minCellWidth, arcAngles);

        return gridInfo;
    }

    /**
     * Recalulates the coordinates of all grid cells. This can occur when;
     * - the scaleProperty equals null or point_count.
     * - scaleCallback changes.
     * - the grid type changes between two types that use the same grid square/circle, hexagon/hexCircle.
     * @param gridInfo Previously calculated grid information.
     * @param options Options for the grid calculation.
     */
    public static recalculateCoords(gridInfo: GridInfo, options: GriddedDataSourceOptions): void {    
        const self = this;

        //Parse the scale expression.
        const scaleExpression = Expression.parse(options.scaleExpression || self.LinearPointCountScaleExpression);
        const minCellWidth = azmaps.math.convertDistance(Math.min(options.minCellWidth, options.cellWidth), options.distanceUnits, 'meters') / self._getGroundResolutionZ22(options.centerLatitude);   

        for(let i= 0, len = gridInfo.cells.length; i < len; i++) {
            gridInfo.cells[i].geometry.coordinates = self.createGridPolygon(gridInfo.cells[i].properties, options, gridInfo.width, gridInfo.height, self._getArcAngles(options.gridType), minCellWidth, scaleExpression, gridInfo.scaleMetrics);
        }
    }

    /**
     * Converts a position to a mercator pixel at zoom level 22.
     * @param pos Position value to convert.
     */
    public static toPixel22(pos: azmaps.data.Position): azmaps.Pixel {
        //Calculate the pixel location of a point at zoom level 22. 
        const sinLatitude = Math.sin(pos[1] * this.PI_By_180);
        const mapSize = this.MapSize22;

        return [
            (pos[0] + 180) / 360 * mapSize,
            (0.5 - Math.log((1 + sinLatitude) / (1 - sinLatitude)) / (Math.PI * 4)) * mapSize
        ];
    }


    /***********************************
     * Private functions
     ***********************************/     

     /**
      * Calculates the cell coordinate for a pixel.
      * @param pixel Pixel to calculate cell for.
      * @param width Width of cell.
      * @param height Height of cell.
      * @param gridType Grid type.
      * @param coord Coordinate to update values on.
      * @param sqrt3 Constant for square root of 3.
      */
     private static _getCellCoord(pixel: azmaps.Pixel, width: number, height: number, gridType: GridType,coord: CubeCoord, sqrt3: number): void {
          //Calculate the cubic coordinate for the data bin that contains the points pixel coordinate.
          switch (gridType) {
            case 'pointyHexagon':
                this._rotatedHexCellCoord(pixel, width, height, coord, sqrt3);
                break;
            case 'hexagon':
            case 'hexCircle':                    
                this._hexCellCoord(pixel, width, height, coord, sqrt3);
                break;
            case 'triangle':
                this._triangleCellCoord(pixel, width, height, coord, sqrt3);
                break;
            default:
                //Square grid system used. 
                coord.col = Math.floor(pixel[0] / width);
                coord.row = Math.floor(pixel[1] / height);
                break;
        }
     }
    
    private static readonly PI_By_180 = Math.PI / 180;
    private static readonly MapSize22 = 512 * Math.pow(2, 22);
    private static readonly InnerRadiusScale = Math.cos(30 * Math.PI / 180);
    private static readonly LinearPointCountScaleExpression =  ['/', ['-', ['get', 'point_count'], ['get', 'min']], ['-',  ['get', 'max'], ['get', 'min']]];
        
    //Cached calculations for arc angle values for cell polygon generation.
    private static _arcAngles: Record<string, ArcAngles> = {};

    /**
      * Ground resolution in meters per pixel for zoom level 22 at the equator for 512x512 size tile system.
      * @param centerLatitude The latitude value to calculate the ground resolution for.
      */
    private static _getGroundResolutionZ22(centerLatitude: number): number{
        return Math.cos(centerLatitude * this.PI_By_180) * 2 * Math.PI * 6378137 / this.MapSize22;
    }

    /**
     * Gets a grid cell for the specified grid type.
     * @param cellId The id of the cell to retrieve from the specified grid system.
     * @param coord The cell cordinate.
     * @param i The index of the point looking for the cell. This will be added to the cells index of points within.
     * @param gridInfo The grid info to retrieve/add the cell info.
     * @param width The width of the cell.
     * @param height The height of the cell.
     * @param gridType The type of grid system being calculated.
     * @param hasAggregates Specifies if aggregates are being calculated.
     */
    private static _getGridCell(cellId: string, coord: CubeCoord, i: number, gridInfo: GridInfo, width: number, height: number, gridType: GridType, hasAggregates: boolean): azmaps.data.Feature<azmaps.data.Polygon, CellInfo> {
        //Check to see if the bin has already been created and indexed.
        const cellIdx = gridInfo.cellLookupTable[cellId];     

        if (cellIdx !== undefined) {
            //If the bin exists, add the point index to pointLookupTable of the bin.
            gridInfo.pointLookupTable[cellId].push(i);

            //Get reference to cell.
            return gridInfo.cells[cellIdx];                
        }

        //Create a grid cell for the specified cubic coordinates.
        const cell = this._createCellFromCubeCoord(cellId, coord, gridType, width, height, hasAggregates);

        //Add the cell information to the grid.
        gridInfo.pointLookupTable[cellId] = [i];
        gridInfo.cells.push(cell);
        gridInfo.cellLookupTable[cellId] = gridInfo.cells.length - 1;

        return cell;
    }    

    /***********************************
     * Cell coordinate functions
     ***********************************/

    /**
     * Calculates the cubic cooridate of a hexagon that is intersected by the specified pixel coordinate.
     * @param pixel A pixel coordinate that intersects the hexagon.
     * @param width The width of the cell.
     * @param height The height of the cell.
     * @param coord A cubic coordinate object to set the values on.
     * @param sqrt3 The constant square rott of 3.
     */
    private static _hexCellCoord(pixel: number[], width: number, height: number, coord: CubeCoord, sqrt3: number): void {   
        coord.col = pixel[0] * 4 / (3 * width);
        coord.z = (pixel[1] - pixel[0] / sqrt3) / height;
        coord.row = -coord.col - coord.z;

        /*var radius = width * 0.5;

        coord.col = pixel[0] * 2 / 3 / radius;
        coord.z = (-pixel[0] + pixel[1] * sqrt3) / 3 / radius;
        coord.row = -coord.col - coord.z;*/


        GridMath._roundCubeCoord(coord);
    }

    /**
     * Calculates the cubic cooridate of a rotated hexagon that is intersected by the specified pixel coordinate.
     * @param pixel A pixel coordinate that intersects the rotated hexagon.
     * @param width The width of the cell.
     * @param height The height of the cell.
     * @param coord A cubic coordinate object to set the values on.
     * @param sqrt3 The constant square rott of 3.
     */
    private static _rotatedHexCellCoord(pixel: number[], width: number, height: number, coord: CubeCoord, sqrt3: number): void {
        coord.col = (pixel[0] - pixel[1] / sqrt3) / width;
        coord.z = 4 * pixel[1] / (3 * height);
        coord.row = -coord.col - coord.z;
        return GridMath._roundCubeCoord(coord);
    }

    /**
     * Given the x, y, and z parameters of a cubic coordinate, this function rounds them off in cubic coordinate space.
     * @param coord A cubic coordinate object to set the values on.
     */
    private static _roundCubeCoord(coord: CubeCoord): void {
        var rx = Math.round(coord.col);
        var ry = Math.round(coord.row);
        var rz = Math.round(coord.z);

        const x_diff = Math.abs(rx - coord.col);
        const y_diff = Math.abs(ry - coord.row);
        const z_diff = Math.abs(rz - coord.z);

        if (x_diff > y_diff && x_diff > z_diff) {
            rx = -ry - rz;
        } else if (y_diff > z_diff) {
            ry = -rx - rz;
        } else {
            rz = -rx - ry;
        }

        coord.col = rx;
        coord.row = ry;
        coord.z = rz;
    }

    /**
     * Calculates the cell coordinate for a triangle. This is the top left corner of a triangle if pointing down or bottom left if pointing up.
     * @param pixel The pixel cooridnate.
     * @param width The width of the triangle cell.
     * @param height The height of the triangle cell.
     * @param coord The coordinate object to set the row/col values on.
     * @param sqrt3 A constant for the square root 3.
     */
    private static _triangleCellCoord(pixel: number[], width: number, height: number, coord: CubeCoord, sqrt3: number): void {
        //Round values.
        coord.row = Math.floor(pixel[1] / height);
        coord.col = Math.floor(pixel[0] / width);
    
        let dy = (coord.row + 1) * height - pixel[1];
        let dx = pixel[0] - coord.col * width;

        if (coord.row % 2 === 1) {
            dy = height - dy;
        } 

        if (dy > 1) {
            if (dx < width * 0.5) {
                // Left half of triangle.
                const ratio = dx / dy;
                if (ratio < 1 / sqrt3){
                    coord.col -= 0.5;
                } 
            } else {
                // Right half of triangle.
                const ratio = (width - dx) / dy;
                if (ratio < 1 / sqrt3) {
                    coord.col += 0.5;
                }
            }
        }
    }
    
    /**
    * Creates an empty polygon feature with CellInfo object from it's center pixel coordinates from the specified cubic coordinate for a hexagon.
    * @param cellId: ID of the cell.
    * @param cube The cubic coordinate of the hexagon.
    * @param gridType The gird type.
    * @param width The width of the cell.
    * @param height The height of the cell.
    * @returns A cell polygon object for a hexagon.
    */
    private static _createCellFromCubeCoord(cellId: string, cube: CubeCoord, gridType: GridType, width: number, height: number, hasAggregates: boolean): azmaps.data.Feature<azmaps.data.Polygon, CellInfo> {
        //Center pixel coordinate value.
        let cx: number;
        let cy: number;
        let rightSideUp: boolean;

        //Calculate center of the bin in pixel coordinates.
        switch (gridType) {
            case 'pointyHexagon':
                cx = width * (cube.col + cube.z * 0.5);
                cy = 0.75 * height * cube.z;
                break;
            case 'hexagon':
            case 'hexCircle':
                cx = 0.75 * width * cube.col;
                cy = height * (cube.z + cube.col * 0.5);
                break;
            case 'triangle':
                cy = Math.floor(cube.row * height);
                cx = Math.floor((cube.col + 0.5) * width);

                // See if this triangle should be drawn
                // right-side up or upside down.
                let whole_col = (Math.abs(cube.col - Math.round(cube.col)) < 0.1);
                if (Math.round(cube.row) % 2 == 0) {
                    // Even row.
                    rightSideUp = whole_col;
                }
                else {
                    // Odd row.
                    rightSideUp = !whole_col;
                }
                break;
            default: //Square and circle based on square grid.
                cx = (cube.col + 0.5) * width;
                cy = (cube.row + 0.5) * height;
                break;
        }

        //Create a data bin object.
        return this._createCell(cellId, cx, cy, rightSideUp, hasAggregates);
    }

    /***********************************
     * Common private functions
     ***********************************/

    /**
     * Gets arc angles from cahced for a grid type or calculates them if needed.
     * @param gridType Grid type
     */
    private static _getArcAngles(gridType: string): ArcAngles {
        //Precalculate arc angle values for cell polygon generation.
        let arcAngles = GridMath._arcAngles[gridType];

        if(!arcAngles){
            switch (gridType) {
                case 'circle':
                case 'hexCircle':
                    arcAngles = this._calculateArcAngles(36);
                    break;
                case 'pointyHexagon':
                    arcAngles = this._calculateArcAngles(6);
                    break;
                case 'hexagon':
                    arcAngles = this._calculateArcAngles(6, 30);
                    break;
            }

            //Cache for faste lookups later.
            GridMath._arcAngles[gridType] = arcAngles;
        }

        return arcAngles;
    }

     /**
      * Calculate the arc angles for a regular polygon.
      * @param numNodes Number of nodes in regular polygon.
      * @param offset Offset angle in degrees.
      */
    private static _calculateArcAngles(numNodes: number, offset?: number): ArcAngles {
        //Default the offset value to 0 if not set.
        offset = (offset) ? offset : 0;

        //The number of degrees between each node.
        const centralAngle = 360 / numNodes;

        //The from the first node to the current node in radians.
        let arcAngleRadians: number;
        let sinArcAngles:number[] = [];
        let cosArcAngles:number[] = [];

        for(let i = 0; i < numNodes; i++) {
            //Calcualte the arc angle from the first node to the current node in radians.
            arcAngleRadians = (i * centralAngle + offset) * this.PI_By_180;
            sinArcAngles.push(Math.sin(arcAngleRadians));
            cosArcAngles.push(Math.cos(arcAngleRadians));
        }
        
        return {
            sin: sinArcAngles,
            cos: cosArcAngles 
        };
    }

    /**
     * Converts a mercator pixel at zoom level 22 to a position.
     * @param pixel Pixel value to convert.
     */
    private static _toPosition22(pixel: azmaps.Pixel): azmaps.data.Position {
        const mapSize = this.MapSize22;

        return [
            360 * ((pixel[0] / mapSize) - 0.5),
            90 - 360 * Math.atan(Math.exp(((pixel[1] / mapSize) - 0.5) * Math.PI * 2)) / Math.PI
        ];
    }

    /**
     * Parses the map expressions from aggregate expressions. 
     * @param aggregateProperties Aggregate expressions to parse.
     */
    private static _parseMapExpressions(aggregateProperties: Record<string, azmaps.AggregateExpression>): Record<string, AggregateExpression> {
        const mapExpressions: Record<string, AggregateExpression> = {};

        if(aggregateProperties){
            let agg:  azmaps.AggregateExpression;
            
            Object.keys(aggregateProperties).forEach(key => {
                agg = aggregateProperties[key];

                //Aggregate expression has the format [operator: string, initialValue: boolean | number, mapExpression: Expression] or [operator: string, mapExpression: Expression]
                if(agg && agg.length >= 2){
                    try {
                        mapExpressions[key] = AggregateExpression.parse(agg);
                     } catch {
                        //Expression is invalid, remove aggregate.
                        aggregateProperties[key] = undefined;
                    }
                } else {
                    //Expression is invalid, remove aggregate.
                    aggregateProperties[key] = undefined;
                }
            });
        }

        return mapExpressions;
    }

    /**
     * Increments point_count, calculates aggregate expression for point and increments cell info accordingly. 
     * @param cellInfo Cell info to increment.
     * @param point Point feature to use with aggregates.
     * @param aggregateProperties Aggregate expression properties.
     * @param mapExpressions Parsed map expressions for aggregates.
     */
    private static _incrementCellInfo(
        cellInfo: CellInfo, 
        point: azmaps.data.Feature<azmaps.data.Point, any>, 
        aggregateProperties: Record<string, azmaps.AggregateExpression>, 
        mapExpressions: Record<string, AggregateExpression>): void {

        cellInfo.point_count++;
               
        if(aggregateProperties){
            let count = cellInfo.point_count;
            let prevValue: number | boolean;
            let newValue: number | boolean;
            let props = cellInfo.aggregateProperties || {};

            Object.keys(aggregateProperties).forEach(key => {
                let agg = aggregateProperties[key];
                let mapExp = mapExpressions[key];

                if(mapExp) {
                    newValue = mapExp.eval(point.properties);

                    //If only one point in the data, we need to initialize the property.
                    if(count === 1){
                        if(Array.isArray(agg[1])){
                            //Expression value is the initializer.
                            prevValue = null;
                        } else {
                            //Second value is the initial value. 
                            prevValue = agg[1];
                        }
                    } else {
                        //Get any previous calculated value.
                        prevValue = props[key];
                    }
                    
                    if(prevValue !== null) {
                        switch(agg[0]){
                            case 'max':
                                newValue = (prevValue > newValue)? prevValue : newValue;
                                break;
                            case 'min':
                                newValue = (prevValue < newValue)? prevValue : newValue;
                                break;
                            case '+':
                                newValue = <number>prevValue + <number>newValue;
                                break;
                            case '*':
                                newValue = <number>prevValue * <number>newValue;
                                break;  
                            case 'all':
                                newValue = <boolean>prevValue && <boolean>newValue;
                                break;  
                            case 'any':
                                newValue = <boolean>prevValue || <boolean>newValue;
                                break;  
                        }
                    }

                    if(newValue !== null){
                        props[key] = newValue;
                    }
                }

                cellInfo.aggregateProperties = props;
            });
        } 
    }

    /**
     * Finalizes cell info by formatting point_count_abbreviated, accounting for init values in aggregates, and extracting scale range values.
     * @param cellInfo The cell info to finalize.
     * @param aggregateExpressions The aggregate expressions to apply.
     * @param scaleMetrics Scale metrics to merge with.
     * @param scaleProperty Property to scale on.
     */
    private static _finalizeCellInfo(cellInfo: CellInfo, aggregateExpressions: Record<string, AggregateExpression>, scaleMetrics?: ScaleRange, scaleProperty?: string): void {
        const count = cellInfo.point_count;

        //Generate an abbreviated version of the point count.
        let abbrv = count.toString();

        if(count >= 1000000){
            abbrv = `${Math.round(count / 1000000)}M`;
        } else if(count >= 1000){
            abbrv =  `${Math.round(count / 1000)}k`;
        } 

        cellInfo.point_count_abbreviated =  abbrv;

        let scaleVal = count;

        if(aggregateExpressions){
            //Finalize all mapped aggregate expressions.
            Object.keys(aggregateExpressions).forEach(key => {
                aggregateExpressions[key].finalize(cellInfo, key);
            });

            if(scaleProperty && typeof cellInfo.aggregateProperties[scaleProperty] !== 'undefined') {
                scaleVal = <number>cellInfo.aggregateProperties[scaleProperty];
            }
        }

        if(scaleMetrics){
            if(typeof scaleMetrics.min === 'undefined'){
                scaleMetrics.min = scaleVal;
                scaleMetrics.max = scaleVal;
            } else {
                scaleMetrics.min = Math.min(scaleMetrics.min, scaleVal);
                scaleMetrics.max = Math.max(scaleMetrics.max, scaleVal);
            }
        }
    }

    /**
     * Creates an empty polygon feature with CellInfo object from it's center pixel coordinates.
     * @param cx Center x pixel coordinate of data bin.
     * @param cy Center y pixel coordinate of data bin.
     * @param rightSideUp If the cell represents a triangle, specifies if it pointing up or not.
     * @param hasAggregates Specifies if aggregates are being calculated.
     * @returns A CellInfo object for the specified center pixel coordinates.
     */
    private static _createCell(cell_id: string, cx: number, cy: number, rightSideUp?: boolean, hasAggregates?: boolean): azmaps.data.Feature<azmaps.data.Polygon, CellInfo> {
        return {
            type: 'Feature',
            properties: {
                cell_id: cell_id,
                aggregateProperties: hasAggregates ? {}: undefined,
                _x: cx,
                _y: cy,
                _rightSideUp: rightSideUp,
                point_count: 0,
                point_count_abbreviated: '0'
            },
            geometry: {
                type: 'Polygon',
                coordinates: []
            }
        };
    }

    /**
    * Creates the data bin polygon for the specified bin.
    * @param cellInfo Information about the cell.
    * @param gridType The type of grid polygon to create.
    * @param width The width of the cell.
    * @param height The height of the cell.
    * @param arcAngles Pre-calculate arc angles for regular polygon creation.
    * @param scaleMetrics Min/max metric value for scaling.
    * @param scaleCallback Scaling callback function.
    * @returns A polygon that represents the data bin.
    */
    private static createGridPolygon(
        cellInfo: CellInfo, 
        options: GriddedDataSourceOptions,
        width: number, 
        height: number,
        arcAngles: ArcAngles, 
        minCellWidth: number,     
        scaleExp: Expression,
        scaleMetrics?: ScaleRange,): azmaps.data.Position[][] {

        let scale = options.coverage || 1;

        //Get the scale value for the data bin if the user has specified a scale callback function.
        if (options.scaleProperty && scaleMetrics) {
            let s = scaleExp.eval(Object.assign({
                min: scaleMetrics.min,
                max: scaleMetrics.max,
            }, cellInfo));

            if (!isNaN(s) && typeof s === 'number') {
                scale *= s;
            }
        }

        //Generate the polygon for the data bin.
        switch (options.gridType) {
            case 'square':
                return this._getSquare(cellInfo, width, scale, minCellWidth);
            case 'hexCircle':
                //For hex cicles we want the inner radius of the hexagon which is calculated as Math.cos(30 * Math.PI / 180) * pixelRadius = 0.8660254037844387 * pixelRadius
                return this._getRegularPolygon(cellInfo, this.InnerRadiusScale * width * 0.5 * scale, arcAngles, minCellWidth);     
            case 'triangle':
                return this._getTriangle(cellInfo, width, height, scale, minCellWidth);
            case 'pointyHexagon':
                //Create a flat hexagon by rotating it 30 degrees.
                return this._getRegularPolygon(cellInfo, height * 0.5 * scale, arcAngles, minCellWidth);
            //case 'hexagon':
            //case 'circle':
            default:
                //Create a flat hexagon by rotating it 30 degrees.
                return this._getRegularPolygon(cellInfo, width * 0.5 * scale, arcAngles, minCellWidth);
        }
    }
    
    /**
     * Generates a cell polygon that has the shape of a regular polygon (hexagon, approximated circle...).
     * @param cellInfo The cell information for the polygon.
     * @param radius The radius of the regular polygon to create in pixels at zoom level 22.
     * @param arcAngles Pre-calculate arc angles for regular polygon creation.
     * @returns A data bin polygon that can be displayed on the map.
     */
    private static _getRegularPolygon(cellInfo: CellInfo, radius: number, arcAngles: ArcAngles, minCellWidth: number): azmaps.data.Position[][] {
        const self = this;

        //The x and y pixel coordinates of each node.
        let dx: number;
        let dy: number;

        const pos: azmaps.data.Position[] = [];
        const mapSize = self.MapSize22;

        if(radius * 2 < minCellWidth) { 
            radius = minCellWidth * 0.5;
        }

        //Using forEach as there is never more than 36 nodes in the polygons.
        arcAngles.sin.forEach((sinArcAngle, i) => {
            //Calculate the pixel coordinates of each node.
            dx = Math.min(Math.max(cellInfo._x + radius * sinArcAngle, 0), mapSize);
            dy = cellInfo._y + radius * arcAngles.cos[i];

            //Convert the pixel value into position at zoom level 22.
            pos.push(self._toPosition22([dx, dy]));
        });

        //Close the ring.
        pos.push(pos[0]);

        //Create a data cell polygon from the array of positions.
        return [pos];
    }
    
    /**
     * Calculates a polygon that is the shape of a square, where scaledPixelRadius is the distance from the center the an edge of the square.
     * @param cellInfo Information about the cell on a square grid.
     * @param width The scaled radius in pixels.
     */
    private static _getSquare(cellInfo: CellInfo, width: number, scale: number, minCellWidth: number): azmaps.data.Position[][] {
        var self = this;

        const scaledHalfWidth = Math.max(width * scale, minCellWidth) * 0.5;

        //Shape is a square.
        const top = cellInfo._y - scaledHalfWidth;
        const bottom = cellInfo._y + scaledHalfWidth;
        const left = Math.max(cellInfo._x - scaledHalfWidth, 0);
        const right = Math.min(cellInfo._x + scaledHalfWidth, self.MapSize22);

        //Create the four corners of the square.        
        //Convert the pixel values into positions at zoom level 22.
        const pos = [
            self._toPosition22([left, top]),
            self._toPosition22([left, bottom]),
            self._toPosition22([right, bottom]),
            self._toPosition22([right, top])
        ];

        //Close the polygon ring.
        pos.push(pos[0]);

        //Create a data cell polygon from the array of positions.
        return [pos];
    }

    /**
     * Calculates the points of a triangular cell.
     * @param cellInfo Information about the cell on a triangular grid.
     * @param width Width of each cell.
     * @param height Height of each cell.
     * @param scale Scale to apply to the polygon.
     */
    private static _getTriangle(cellInfo: CellInfo, width: number, height: number, scale: number, minCellWidth: number): azmaps.data.Position[][] {
        const self = this;

        let pos: azmaps.data.Position[];

        //Cache the x offset to reduce lookups and allow for better minification.
        const offsetX = cellInfo._x;  

        //Need to offset vertically to account for scale so that the triangle appears near the center of the grid cell.
        const offsetY = cellInfo._y + (height - height * scale) * 0.5;

        //Scale the width/height values.
        width *= scale;
        height *= scale;

        if(width < minCellWidth){
            height *=  minCellWidth / width;
        }

        //Calculate the half with
        const halfWidth = width * 0.5;    
        
        const mapSize = self.MapSize22;
        
        let x1 = offsetX;
        let x2 = offsetX + halfWidth;
        let x3 = offsetX - halfWidth;
        
        //Clamp the triangle coordinates to a single globe and clip at the anti-Meridian. 
        if(x3 < 0){
            x1 = Math.max(x1, 0);
            x2 = Math.max(x2, 0);
            x3 = Math.max(x3, 0);
        } else if (x2 > mapSize){
            x1 = Math.min(x1, mapSize);
            x2 = Math.min(x2, mapSize);
            x3 = Math.min(x3, mapSize);
        }

        //Calculate points of the triangle.
        if (cellInfo._rightSideUp) {
            pos = [
                self._toPosition22([x1, offsetY]),
                self._toPosition22([x2, height + offsetY]),
                self._toPosition22([x3, height + offsetY])
            ];
        } else {
            pos = [
                self._toPosition22([x1, height + offsetY]),
                self._toPosition22([x2, offsetY]),
                self._toPosition22([x3, offsetY])
            ];
        }
        
        //Close the polygon ring.
        pos.push(pos[0]);

        //Create a 2D array of positions for use as a Polygon.
        return [pos];
    }

    /**
     * Finalizes grid by calculating aggregate calculations, point_count_abbreviated and scale metrics then creating polygons.
     * @param gridInfo Grid infor to finalize.
     * @param width The width of the cell.
     * @param height The height of the cell.
     * @param minCellWidth The min width of the cell when scaling.
     * @param options Options for the grid.
     * @param aggregateExpressions Aggregate data value expressions.
     * @param scaleExpression The scaling expression to apply.
     * @param arcAngles Pre-calculate arc angles for regular polygon creation.
     */
    private static _finalizeGrid(
        gridInfo: GridInfo, 
        width: number, 
        height: number, 
        options: GriddedDataSourceOptions, 
        aggregateExpressions: Record<string, AggregateExpression>, 
        scaleExpression: Expression, 
        minCellWidth: number,
        arcAngles: ArcAngles): void {

        const scaleMetrics: ScaleRange = {};
        const len = gridInfo.cells.length;

        //Finish aggregate calculations, calculate point_count_abbreviated and scale metrics.
        if(options.scaleProperty){
            //If there is a scaleProperty, we must finalize all cells before we calculate coordinates. 
            for(let i = 0; i < len; i++) {
                this._finalizeCellInfo(gridInfo.cells[i].properties, aggregateExpressions, scaleMetrics, options.scaleProperty);
            }

            //Calculate polygon coordinates for cell.
            for(let i = 0; i < len; i++) {
                gridInfo.cells[i].geometry.coordinates = GridMath.createGridPolygon(gridInfo.cells[i].properties, options, width, height, arcAngles, minCellWidth, scaleExpression, scaleMetrics);
            }
        } else {
            //If there is no scaleProperty, we can finalize cells and calculate polygons at the same time.
            for(let i = 0; i < len; i++) {
                this._finalizeCellInfo(gridInfo.cells[i].properties, aggregateExpressions, scaleMetrics, options.scaleProperty);
    
                //Calculate polygon coordinates for cell.
                gridInfo.cells[i].geometry.coordinates = GridMath.createGridPolygon(gridInfo.cells[i].properties, options, width, height, arcAngles, minCellWidth, scaleExpression, scaleMetrics);
            }
        }

        gridInfo.scaleMetrics = scaleMetrics;
    }
}