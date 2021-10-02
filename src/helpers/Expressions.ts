/*
  Supported:

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
    ['all', boolean, boolean]
    ['any', boolean, boolean]

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


    Future:
    interpolate 

*/


export interface Expression {
  eval(val: any): any;
}

export interface SimpleExpression extends Array<any> { }

export class Expression {
  static parse(exp: any[]): Expression {
    if (Array.isArray(exp)) {
      if (exp.length > 0) {
        const e = Expressions[exp[0]];
        if (e) {
          return e.parse(exp);
        }
      }
    } else {
      return new Expressions.literal(exp);
    }

    throw 'Invalid expression';
  }
}

class ComparisonExp implements Expression {
  private _c: string;
  private _e1: Expression;
  private _e2: Expression;

  constructor(comp: string, e1: Expression, e2: Expression) {
    const self = this;
    self._c = comp;
    self._e1 = e1;
    self._e2 = e2;
  }

  static parse(exp: any[]): ComparisonExp {
    if (exp.length >= 3) {
      return new ComparisonExp(exp[0], Expression.parse(exp[1]), Expression.parse(exp[2]));
    }

    throw `Invalid '${exp[1]}' expression.`;
  }

  public eval(val: any): any {
    const self = this;
    const v1 = self._e1.eval(val);
    const v2 = self._e2.eval(val);

    switch (self._c) {
      case '<':
        return v1 < v2;
      case '<=':
        return v1 <= v2;
      case '==':
        return v1 == v2;
      case '!=':
        return v1 != v2;
      case '>':
        return v1 > v2;
      case '>=':
        return v1 >= v2;
      case '>':
        return v1 > v2;
    }

    throw 'Invalid comparison';
  }
}

class MathExp implements Expression {
  private _o: string;
  private _e: (number | Expression)[];

  constructor(operation: string, e: (number | Expression)[]) {
    this._o = operation;
    this._e = e;
  }

  static parse(exp: SimpleExpression): MathExp {
    if (exp.length >= 3) {
      let conditions: (number | Expression)[] = [];

      for (var i = 1, len = exp.length; i < len; i++) {
        if (Array.isArray(exp[1])) {
          conditions.push(Expression.parse(exp[i]));
        } else {
          conditions.push(exp[i]);
        }
      }

      return new MathExp(exp[0], conditions);
    }

    throw `Invalid '${exp[0]}' expression.`;
  }

  public eval(val: any): any {
    const self = this;
    const math = Math;
    const v1 = (self._e.length >= 1) ? self._getValue(val, self._e[0]) : 0;
    const v2 = (self._e.length >= 2) ? self._getValue(val, self._e[1]) : 0;

    switch (self._o) {
      case '+':
      case '*':
      case 'min':
      case 'max':
        self._evalArray(val);
        break;
      case '-':
        return v2 - v1;
      case '/':
        return v1 / v2;
      case '%':
        return v1 % v2;
      case '^':
        return math.pow(v1, v2);
      case 'abs':
        return math.abs(v1);
      case 'acos':
        return math.acos(v1);
      case 'asin':
        return math.asin(v1);
      case 'atan':
        return math.atan(v1);
      case 'ceil':
        return math.ceil(v1);
      case 'cos':
        return math.cos(v1);
      case 'e':
        return math.exp(v1);
      case 'floor':
        return math.floor(v1);
      case 'ln':
        return math.log(v1);
      case 'ln2':
        return math.LN2;
      case 'log10':
        return math.log(v1) / math.LN10;
      case 'log2':
        return math.log(v1) / math.LN2;
      case 'pi':
        return math.PI;
      case 'round':
        return math.round(v1);
      case 'sin':
        return math.sin(v1);
      case 'sqrt':
        return math.sqrt(v1);
      case 'tan':
        return math.tan(v1);
    }

    throw `Invalid '${self._o}' expression.`;
  }

  private _evalArray(val: any): number {
    const self = this;
    var f: (total: number, arg: number | Expression) => number;
    var init = 0;

    switch (self._o) {
      case '+':
        f = (total, arg) => total + self._getValue(val, arg);
        break;
      case '*':
        init = 1;
        f = (total, arg) => total * self._getValue(val, arg);
        break;
      case 'max':
        init = self._getValue(val, self._e[0]);
        f = (total, arg) => Math.max(total, self._getValue(val, arg));
        break;
      case 'min':
        init = self._getValue(val, self._e[0]);
        f = (total, arg) => Math.min(total, self._getValue(val, arg));
        break;
    }

    return <number>self._e.reduce(f, init);
  }

  private _getValue(val: any, e: number | Expression): number {
    return (typeof e === 'number') ? e : e.eval(val);
  }
}

//[operator: string, mapExpression: Expression]
//[operator: string, initialValue: boolean | number, mapExpression: Expression]
export class CellAggregateExpression implements Expression {
  private _o: string;
  private _i: boolean | number;
  private _e: Expression;

  constructor(operator: string, e: Expression, init?: number | number) {
    const self = this;
    self._o = operator;
    self._e = e;
    self._i = init;
  }

  static parse(exp: SimpleExpression): CellAggregateExpression {
    if (exp.length >= 3) {
      return new CellAggregateExpression(exp[0], Expression.parse(exp[2]), exp[1]);
    } else if (exp.length === 2) {
      return new CellAggregateExpression(exp[0], Expression.parse(exp[1]));
    }

    throw "Invalid 'CellAggregateExpression'.";
  }

  public eval(val: any): any {
    return this._e.eval(val);
  }

  public finalize(properties: any, key: string): void {

    if (properties.aggregateProperties) {
      const self = this;
      let val = <boolean | number>properties.aggregateProperties[key];
      const init = self._i;

      if (typeof init !== 'undefined') {
        switch (self._o) {
          case 'max':
            val = Math.max(<number>init, <number>val);
            break;
          case 'min':
            val = Math.min(<number>init, <number>val);
            break;
          case '+':
            //Sum values and we will devide by point count in finialize stage to get average.
            val = <number>init + <number>val;
            break;
          case '*':
            val = <number>init * <number>val;
            break;
          case 'all':
            val = <boolean>init && <boolean>val;
            break;
          case 'any':
            val = <boolean>init || <boolean>val;
            break;
        }
      }

      properties.aggregateProperties[key] = val;
    }
  }
}

var Expressions = {
  //['get', string]
  //['get', string, object]
  get: class Get implements Expression {
    private _n: string;
    private _e: Expression;

    constructor(name: string, e?: Expression) {
      this._n = name;
      this._e = e;
    }

    static parse(exp: SimpleExpression): Get {
      let e: Expression = (exp.length >= 3) ? Expression.parse(exp[2]) : undefined;

      if (exp.length >= 2) {
        return new Get(exp[1], e);
      }

      throw "Invalid 'get' expression.";
    }

    public eval(val: any): any {
      let o = val;

      if (this._e) {
        o = this._e.eval(val);
      }

      return o[this._n];
    }
  },

  //['has', string]
  //['has', string, object]
  has: class Has implements Expression {
    private _n: string;
    private _e: Expression;

    constructor(name: string, e?: Expression) {
      this._n = name;
      this._e = e;
    }

    static parse(exp: SimpleExpression): Has {
      let e: Expression = (exp.length >= 3) ? Expression.parse(exp[2]) : undefined;

      if (exp.length >= 2) {
        return new Has(exp[1], e);
      }

      throw "Invalid 'has' expression.";
    }

    public eval(val: any): any {
      let o = val;

      if (this._e) {
        o = this._e.eval(val)[this._n];
      }

      return Object.keys(o).indexOf(this._n) > -1;
    }
  },

  //['literal', array | object]
  literal: class Literal implements Expression {
    private _v: any;

    constructor(val: any) {
      this._v = val;
    }

    static parse(exp: SimpleExpression): Literal {
      if (exp.length >= 2) {
        return new Literal(exp[1]);
      }

      throw "Invalid 'literal' expression.";
    }

    public eval(val: any): any {
      return this._v;
    }
  },

  //['at', number, array]
  at: class At implements Expression {
    private _i: number;
    private _e: Expression;

    constructor(idx: number, e: Expression) {
      this._i = idx;
      this._e = e;
    }

    static parse(exp: SimpleExpression): At {
      if (exp.length >= 3) {
        return new At(exp[1], Expression.parse(exp[2]));
      }

      throw "Invalid 'at' expression.";
    }

    public eval(val: any): any {
      return this._e.eval(val)[this._i];
    }
  },

  //['index-of', boolean | string | number, array | string]
  //['index-of', boolean | string | number, array | string, number]
  'index-of': class IndexOf implements Expression {
    private _v: boolean | string | number;
    private _i: number;
    private _e: Expression;

    constructor(value: boolean | string | number, e: Expression, idx: number) {
      const self = this;
      self._v = value;
      self._e = e;
      self._i = idx;
    }

    static parse(exp: SimpleExpression): IndexOf {
      let idx = 0;

      if (exp.length >= 4) {
        idx = exp[3];
      }

      if (exp.length >= 3) {
        return new IndexOf(exp[1], Expression.parse(exp[2]), idx);
      }

      throw "Invalid 'index-of' expression.";
    }

    public eval(val: any): any {
      const self = this;
      return self._e.eval(val).indexOf(self._v, self._i);
    }
  },

  //['length', string | array]
  length: class Length implements Expression {
    private _e: Expression;

    constructor(arr: Expression) {
      this._e = arr;
    }

    static parse(exp: SimpleExpression): Length {
      if (exp.length >= 3) {
        return new Length(Expression.parse(exp[1]));
      }

      throw "Invalid 'length' expression.";
    }

    public eval(val: any): any {
      return this._e.eval(val).length;
    }
  },

  //['slice', array | string, number]
  //['slice', array | string, number, number]
  slice: class Slice implements Expression {
    private _s: number;
    private _e: number;
    private _v: Expression;

    constructor(value: Expression, start: number, end: number) {
      const self = this;
      self._v = value;
      self._s = start;
      self._e = end;
    }

    static parse(exp: SimpleExpression): Slice {
      let idx;

      if (exp.length >= 4) {
        idx = exp[3];
      }

      if (exp.length >= 3) {
        return new Slice(Expression.parse(exp[1]), exp[2], idx);
      }

      throw "Invalid 'index-of' expression.";
    }

    public eval(val: any): any {
      const self = this;
      return self._v.eval(val).slice(self._s, self._e);
    }
  },

  //['!', boolean]
  '!': class Not implements Expression {
    private _e: Expression;

    constructor(e: Expression) {
      this._e = e;
    }

    static parse(exp: any[]): Not {
      if (exp.length >= 2) {
        return new Not(Expression.parse(exp[1]));
      }

      throw "Invalid '!' expression.";
    }

    public eval(val: any): any {
      return !this._e.eval(val);
    }
  },

  //['!=', value, value]
  '!=': ComparisonExp,

  //['<!=>', value, value]
  '<': ComparisonExp,

  //['<=', value, value]
  '<=': ComparisonExp,

  //['==', value, value]
  '==': ComparisonExp,

  //['>', value, value]
  '>': ComparisonExp,

  //['>=', value, value]
  '>=': ComparisonExp,

  // ['to-boolean', value]
  'to-boolean': class toBoolean implements Expression {
    private _e: Expression;

    constructor(e: Expression) {
      this._e = e;
    }

    static parse(exp: any[]): toBoolean {
      if (exp.length >= 2) {
        return new toBoolean(Expression.parse(exp[1]));
      }

      throw "Invalid 'to-boolean' expression.";
    }

    public eval(val: any): any {
      var v = this._e.eval(val);

      if (typeof v === 'boolean') {
        return v;
      } else if (typeof v === 'string') {
        return ['true', 'yes', 'on', '1'].indexOf(v.toLowerCase()) > -1;
      } else if (typeof v === 'number') {
        return v === 1;
      }

      return false;
    }
  },

  //['to-number', value]
  'to-number': class toNumber implements Expression {
    private _e: Expression;

    constructor(e: Expression) {
      this._e = e;
    }

    static parse(exp: any[]): toNumber {
      if (exp.length >= 2) {
        return new toNumber(Expression.parse(exp[1]));
      }

      throw "Invalid 'to-number' expression.";
    }

    public eval(val: any): any {
      var v = this._e.eval(val);

      if (typeof v === 'boolean') {
        return (v) ? 1 : 0;
      } else if (typeof v === 'string') {
        return Number.parseFloat(v);
      } else if (typeof v === 'number') {
        return v;
      }

      return Number.NaN;
    }
  },

  //['to-string', value]
  'to-string': class toString implements Expression {
    private _e: Expression;

    constructor(e: Expression) {
      this._e = e;
    }

    static parse(exp: any[]): toString {
      if (exp.length >= 2) {
        return new toString(Expression.parse(exp[1]));
      }

      throw "Invalid 'to-number' expression.";
    }

    public eval(val: any): any {
      var v = this._e.eval(val);

      if (v.toString) {
        return v.toString();
      }

      return Number.NaN;
    }
  },

  //['typeof', value]
  typeof: class TypeOf implements Expression {
    private _e: Expression;

    constructor(e: Expression) {
      this._e = e;
    }

    static parse(exp: any[]): TypeOf {
      if (exp.length >= 2) {
        return new TypeOf(Expression.parse(exp[1]));
      }

      throw "Invalid 'typeOf' expression.";
    }

    public eval(val: any): any {
      return typeof this._e.eval(val);
    }
  },

  /*
    [
        'case',
        condition1: boolean, 
        output1: value,
        condition2: boolean, 
        output2: value,
        ...,
        fallback: value
    ]
  */
  case: class Case implements Expression {
    private _e: Expression[];
    private _o: (string | number | boolean)[];
    private _f: string | number | boolean;

    constructor(conditions: Expression[], outputs: (string | number | boolean)[], fallback: string | number | boolean) {
      const self = this;
      self._e = conditions;
      self._o = outputs;
      self._f = fallback;
    }

    static parse(exp: any[]): Case {
      if (exp.length >= 3 && exp.length % 2 === 0) {
        let conditions: Expression[] = [];
        let outputs: any[] = [];

        for (var i = 1, len = exp.length; i < len; i += 2) {
          conditions.push(Expression.parse(exp[i]));
          outputs.push(exp[i + 1]);
        }

        return new Case(conditions, outputs, exp[exp.length - 1]);
      }

      throw "Invalid 'case' expression.";
    }

    public eval(val: any): any {
      const self = this;
      let c: boolean;
      for (var i = 0, len = self._e.length; i < len; i++) {
        c = self._e[i].eval(val);

        if (c) {
          return self._o[i];
        }
      }

      return self._f;
    }
  },

  /*
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
  */
  match: class Match implements Expression {
    private _i: Expression;
    private _l: (string | number | boolean)[];
    private _o: (string | number | boolean)[];
    private _f: string | number | boolean;

    constructor(input: Expression, labels: (string | number | boolean)[], outputs: (string | number | boolean)[], fallback: string | number | boolean) {
      const self = this;
      self._i = input;
      self._l = labels;
      self._o = outputs;
      self._f = fallback;
    }

    static parse(exp: any[]): Match {
      if (exp.length >= 5 && exp.length % 2 === 1) {
        let input = Expression.parse(exp[1]);
        let labels: any[] = [];
        let outputs: any[] = [];

        for (var i = 2, len = exp.length - 1; i < len; i += 2) {
          labels.push(exp[i]);
          outputs.push(exp[i + 1]);
        }

        return new Match(input, labels, outputs, exp[exp.length - 1]);
      }

      throw "Invalid 'match' expression.";
    }

    public eval(val: any): any {
      const self = this;
      let v = self._i.eval(val);

      for (var i = 0, len = self._l.length; i < len; i++) {
        if (self._l[i] === v) {
          return self._o[i];
        }
      }

      return self._f;
    }
  },

  /*
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
  */
  step: class Step implements Expression {
    private _i: Expression;
    private _l: (string | number | boolean)[];
    private _o: (string | number | boolean)[];

    constructor(input: Expression, labels: (string | number | boolean)[], outputs: (string | number | boolean)[]) {
      const self = this;
      self._i = input;
      self._l = labels;
      self._o = outputs;
    }

    static parse(exp: any[]): Step {
      if (exp.length >= 5 && exp.length % 2 === 1) {
        let input = Expression.parse(exp[1]);
        let labels: any[] = [];
        let outputs: any[] = [];

        //Add the base
        outputs.push(exp[2]);

        for (var i = 3, len = exp.length; i < len; i += 2) {
          labels.push(exp[i]);
          outputs.push(exp[i + 1]);
        }

        return new Step(input, labels, outputs);
      }

      throw "Invalid 'step' expression.";
    }

    public eval(val: any): any {
      const self = this;
      let v = self._i.eval(val);

      for (var i = 0, len = self._l.length; i < len; i++) {
        if (v <= self._l[i]) {
          return self._o[i];
        }
      }

      return self._o[self._o.length - 1];
    }
  },

  //['in', boolean | string | number, array]
  //['in', substring, string]
  in: class In implements Expression {
    private _i: boolean | string | number;
    private _e: Expression;

    constructor(idx: number, e: Expression) {
      this._i = idx;
      this._e = e;
    }

    static parse(exp: SimpleExpression): In {
      if (exp.length >= 3) {
        return new In(exp[1], Expression.parse(exp[2]));
      }

      throw "Invalid 'at' expression.";
    }

    public eval(val: any): any {
      return this._e.eval(val).indexOf(this._i) > -1;
    }
  },

  //['all', boolean, boolean, …]  
  all: class All implements Expression {
    private _e: Expression[];

    constructor(e: Expression[]) {
      this._e = e;
    }

    static parse(exp: SimpleExpression): All {
      if (exp.length >= 3 && exp.length % 2 === 0) {
        let conditions: Expression[] = [];

        for (var i = 1, len = exp.length; i < len; i++) {
          conditions.push(Expression.parse(exp[i]));
        }

        return new All(conditions);
      }

      throw "Invalid 'all' expression.";
    }

    public eval(val: any): any {
      let state = true;

      this._e.forEach(e => {
        state = state && e.eval(val);
      })

      return state;
    }
  },

  //['any', boolean, boolean, …]
  any: class Any implements Expression {
    private _e: Expression[];

    constructor(e: Expression[]) {
      this._e = e;
    }

    static parse(exp: SimpleExpression): Any {
      if (exp.length >= 3 && exp.length % 2 === 0) {
        let conditions: Expression[] = [];

        for (var i = 1, len = exp.length; i < len; i++) {
          conditions.push(Expression.parse(exp[i]));
        }

        return new Any(conditions);
      }

      throw "Invalid 'any' expression.";
    }

    public eval(val: any): any {
      let state = false;

      this._e.forEach(e => {
        state = state || e.eval(val);
      })

      return state;
    }
  },

  '+': MathExp,
  '*': MathExp,
  'min': MathExp,
  'max': MathExp,
  '-': MathExp,
  '/': MathExp,
  '%': MathExp,
  '^': MathExp,
  'abs': MathExp,
  'acos': MathExp,
  'asin': MathExp,
  'atan': MathExp,
  'ceil': MathExp,
  'cos': MathExp,
  'e': MathExp,
  'floor': MathExp,
  'ln': MathExp,
  'ln2': MathExp,
  'log10': MathExp,
  'log2': MathExp,
  'pi': MathExp,
  'round': MathExp,
  'sin': MathExp,
  'sqrt': MathExp,
  'tan': MathExp
}