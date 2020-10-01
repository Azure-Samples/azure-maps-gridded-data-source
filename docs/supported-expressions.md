
# Supported expressions

The following are details about data driven style expressions support in the Azure Maps Gridded Data Source module.

## Aggregate expression

An aggregate expression defines a calculation that is processed over a set of data. 

Schema: `[operator: string, initialValue?: boolean \| number, mapExpression: Expression]` 

* `operator`: An expression function that is then applied to against all values calculated by the mapExpression for each point in the cluster. Supported operators: 

  - For numbers: `+`, `*`, `max`, `min` 
  - For Booleans: `all`, `any` 
    
* `initialValue`: Optional, an initial value in which the first calculated value is aggregated against. 
* `mapExpression`: An expression that is applied against each point in the data set.

## Supported data-driven expressions

The following expressions are supported by the `mapExpression` parameter of an aggregate expression and the `scaleExpression` option of a gridded data source.

```
    ['get', string]
    ['get', string, object]
    ['has', string]
    ['has', string, object]
    ['literal', array | object]
    ['typeof', value]

    ['at', number, array]
    ['length', string | array]
    ['in', boolean | string | number, array]
    ['in', substring, string]
    ['index-of', boolean | string | number, array | string]
    ['slice', array | string, number]
    ['slice', array | string, number, number]
    ['index-of', boolean | string | number, array | string]
    ['index-of', boolean | string | number, array | string, number]

    ['!', boolean]
    ['!=', value, value]
    ['<', value, value]
    ['<=', value, value]
    ['==', value, value]
    ['>', value, value]
    ['>=' value, value]
    ['all', boolean, boolean, …]
    ['any', boolean, boolean, …]

    ['to-boolean', value]
    ['to-number', value]
    ['to-string', value]

    ['+', number, number]
    ['-', number]
    ['-', number, number]
    ['*', number, number]
    ['/', number, number]
    ['%', number, number]
    ['^', number, number]
    ['abs', number]
    ['acos', number]
    ['asin', number]
    ['atan', number]
    ['ceil', number]
    ['cos', number]
    ['e']
    ['floor', number]
    ['ln', number]
    ['ln2']
    ['log10', number]
    ['log2', number]
    ['max', number, number]
    ['min', number, number]
    ['pi']
    ['round', number]
    ['sin', number]
    ['sqrt', number]
    ['tan', number]
    
    [
        'case',
        condition1: boolean, 
        output1: value,
        condition2: boolean, 
        output2: value,
        ...,
        fallback: value
    ]

    [
        'match',
        input: number | string,
        label1: number | string | (number | string)[], 
        output1: value,
        label2: number | string | (number | string)[], 
        output2: value,
        ...,
        fallback: value
    ]

    [
      'step',
      input: number,
      output0: value0,
      stop1: number, 
      output1: value1,
      stop2: number, 
      output2: value2, 
      ...
    ]
```