# API Reference

The following is the API reference for the Azure Maps Gridded Data Source module.

## GriddedDataSource class

Extends: `atlas.source.Source`

Namespace: `atlas.source`

A data source for aggregating point features into cells of a grid system and will generate polygons to represent each grid cell. 
Use the `PolygonLayer` and `LineLayer` classes to render the data in this data source.

Point features will be extracted from `atlas.Shape` objects, but this shape will not be data bound.

**Contstructor**

> `GriddedDataSource(id?: string, options?: GriddedDataSourceOptions)`

**Methods** 

| Name | Return type | Description |
|------|-------------|-------------|
| `add(points: atlas.data.FeatureCollection \| atlas.data.Feature<atlas.data.Point, any> \| atlas.data.Point \| atlas.Shape \| Array<atlas.data.Feature<atlas.data.Point, any> \| atlas.data.Point \| atlas.Shape>)` | | Adds points to the data source. |
| `clear()` | | Removes all data in the data source. |
| `dispose()` | | Cleans up any resources this data source is consuming. |
| `getCellChildren(cell_id: string)` | `atlas.data.Feature<atlas.data.Point, any>[]` | Gets all points that are within the specified grid cell. |
| `getGridCells()` | `atlas.data.FeatureCollection` | Gets all grid cell polygons as a GeoJSON FeatureCollection. |
| `getId()` | `string` | Gets the ID of the data source. |
| `getOptions()` | `GriddedDataSourceOptions` | Gets the options used by the data source. |
| `getPoints()` | `atlas.data.FeatureCollection` | Gets all points as a GeoJSON FeatureCollection. |
| `importDataFromUrl(url: string)` | `Promise<void>` | Downloads a GeoJSON document and imports its data into the data source. The GeoJSON document must be on the same domain or accessible using CORS. |
| `remove(point: number \| string \| atlas.data.Feature<atlas.data.Point, any> \| atlas.Shape \| Array<number \| string \| atlas.data.Feature<atlas.data.Point, any>> \| atlas.Shape)` |  | Removes one or more points from the data source. If a string is passed in, it is assumed to be an id. If a number is passed in, removes the point at that index. |
| `removeById(id: number \| string \| Array<number \| string>)` |  | Removes one or more points from the datasource based on its id. |
| `setOptions(options: GriddedDataSourceOptions)` |  | Sets the data source options. The data source will retain its current values for any option not specified in the supplied options. |
| `setPoints(points: atlas.data.FeatureCollection \| Array<atlas.data.Feature<atlas.data.Point, any> \| atlas.data.Point \| atlas.Shape>)` |  | Overwrites all points in the data source with the new array of points. |

**Usage**

The following shows how to create an instance of the `GriddedDataSource` class, import data from a GeoJSON file via a URL, connect it to a polygon layer to render it on a map.

```javascript
//Create an instance of the gridded data source.
var datasource = new atlas.source.GriddedDataSource(null, {
    cellWidth: 1,
    distanceUnits: 'miles',
    //Optionally create an aggregate property to calculate the sum of the 'value' property of all points within each cell.
    aggregateProperties: {
        total: ['+', ['get', 'value']]
    }
});
map.sources.add(datasource);

//Create a layer to render the grid cells polygon area and add to the map.
map.layers.add(new atlas.layer.PolygonLayer(datasource));

datasource.importDataFromUrl('URL to a GeoJSON file');
```

## GriddedDataSourceOptions interface

Options for a gridded data source.

| Name | Value | Description |
|------|-------|-------------|
| `aggregateProperties` | `Record<string, atlas.AggregateExpression>` | Defines custom properties that are calculated using expressions against all the points within each grid cell and added to the properties of each grid cell polygon. See also the [Supported Expressions](supported-expressions.md) document for more details. |
| `cellWidth` | `number` | The spatial width of each cell in the grid in the specified distance units. Default: `25000` |
| `centerLatitude` | `number` | The latitude value used to calculate the pixel equivalent of the cellWidth. Default: `0` |
| `coverage` | `number` | A number between 0 and 1 that specifies how much area a cell polygon should consume within the grid cell. This applies a multiplier to the scale of all cells. If `scaleProperty` is specified, this will add additional scaling. Default: `1` |
| `distanceUnits` | `atlas.math.DistanceUnits` | The distance units of the cellWidth option. Default: `meters` |
| `gridType` | `GridType` | The shape of the data bin to generate. Default: `hexagon` |
| `minCellWidth` | `number` | The minimium cell width to use by the coverage and scaling operations. Will be snapped to the `cellWidth` if greater than that value. Default: `0` |
| `maxZoom` | `number` | Maximum zoom level at which to create vector tiles (higher means greater detail at high zoom levels). Default: `18` |
| `scaleExpression` | `atlas.Expression` | A data driven expression that customizes how the scaling function is done. This expression has access to the properties of the cell (CellInfo) and the following two properties;<br/><br/>`min` - The minimium aggregate value across all cells in the data source.<br/>`max` - The maximium aggregate value across all cells in the data source.<br/><br/>A linear scaling function based on the "point_count" property is used by default `scale = (point_count - min)/(max - min)`.<br/><br/>Default: `['/', ['-', ['get', 'point_count'], ['get', 'min']], ['-',  ['get', 'max'], ['get', 'min']]]` |
| `scaleProperty` | `string` | The aggregate property to calculate the `min`/`max` values over the whole data set. Can be an aggregate property or `point_count`. |

## GridType enum

Namespace: `atlas`

Specifies how data is rendered wintin a grid system.

**Properties** 

| Name | Value | Description |
|------|-------|-------------|
| `circle` | `'circle'` | Renders data within a square grid as circles. |
| `hexagon` | `'hexagon'` | Renders data within a hexagons grid. |
| `hexCircle` | `'hexCircle'` | Renders data within a hexagon grid as circles. |
| `pointyHexagon` | `'pointyHexagon'` | Renders data within a rotate hexagon grid. |
| `square` | `'square'` | Renders data within a square grid. |
| `triangle` | `'sqtriangleuare'` | Renders data within a triangular grid. |

## ScaleRange interface

An object that represents a range of values.

| Name | Value | Description |
|------|-------|-------------|
| `min` | `number` | The minimum range value. |
| `max` | `number` | The maximum range value. |

## CellInfo interface

Properties of a grid cell polygon.

| Name | Value | Description |
|------|-------|-------------|
| `aggregateProperties` | `Record<string, number \| boolean>` | The calculated aggregate values. |
| `cell_id` | `string` | A unique ID for the cluster that can be used with the `GriddedDataSource` `getCellChildren` methods.  |
| `point_count` | `number` | The number of pounts in the cell. |
| `point_count_abbreviated` | `string` | A string that abbreviates the point_count value if it's long. (for example, 4,000 becomes 4K) |

