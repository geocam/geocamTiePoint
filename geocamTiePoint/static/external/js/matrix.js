// __NO_RELICENSE__

/**
 * Generic matrix class. Built for readability, not for speed.
 * 
 * Copyright (c) 2008 Steven Wittens (www.acko.net)
 * Licensed under the MIT license, see LICENSE_PROJECTIVE.
 */

var Matrix = function (w, h, values) {
  this.w = w;
  this.h = h;
  this.values = values || Matrix.allocate(w, h);
};

Matrix.allocate = function (w, h) {
  var values = [];
  for (var i = 0; i < h; ++i) {
    values[i] = [];
    for (var j = 0; j < w; ++j) {
      values[i][j] = 0;
    }
  } 
  return values; 
}

Matrix.cloneValues = function (values) {
  clone = [];
  for (var i = 0; i < values.length; ++i) {
    clone[i] = [].concat(values[i]);
  } 
  return clone; 
}

Matrix.columnVectorFromList = function (lst) {
    var result = new Matrix(1, lst.length);
    for (var i = 0; i < lst.length; ++i) {
        result.values[i][0] = lst[i];
    }
    return result;
}

Matrix.prototype.add = function (operand) {
  if (operand.w != this.w || operand.h != this.h) {
    throw "Matrix add size mismatch";
  }

  var values = Matrix.allocate(this.w, this.h);
  for (var y = 0; y < this.h; ++y) {
    for (var x = 0; x < this.w; ++x) {
      values[y][x] = this.values[y][x] + operand.values[y][x];
    }
  }
  return new Matrix(this.w, this.h, values);
};

Matrix.prototype.subtract = function (operand) {
  if (operand.w != this.w || operand.h != this.h) {
    throw "Matrix add size mismatch";
  }

  var values = Matrix.allocate(this.w, this.h);
  for (var y = 0; y < this.h; ++y) {
    for (var x = 0; x < this.w; ++x) {
      values[y][x] = this.values[y][x] - operand.values[y][x];
    }
  }
  return new Matrix(this.w, this.h, values);
};

Matrix.prototype.transformProjectiveVector = function (operand) {
  var out = [];
  for (var y = 0; y < this.h; ++y) {
    out[y] = 0;
    for (var x = 0; x < this.w; ++x) {
      out[y] += this.values[y][x] * operand[x];
    }
  }
  var iz = 1 / (out[out.length - 1]);
  for (var y = 0; y < this.h; ++y) {
    out[y] *= iz;
  }
  return out;
}

Matrix.prototype.multiply = function (operand) {
  if (+operand !== operand) {
    // Matrix mult
    if (operand.h != this.w) {
      throw "Matrix mult size mismatch";
    }
    var values = Matrix.allocate(operand.w, this.h);
    for (var y = 0; y < this.h; ++y) {
      for (var x = 0; x < operand.w; ++x) {
        var accum = 0;
        for (var s = 0; s < this.w; s++) {
          accum += this.values[y][s] * operand.values[s][x];
        }
        values[y][x] = accum;
      }
    }
    return new Matrix(operand.w, this.h, values);
  }
  else {
    // Scalar mult
    var values = Matrix.allocate(this.w, this.h);
    for (var y = 0; y < this.h; ++y) {
      for (var x = 0; x < this.w; ++x) {
        values[y][x] = this.values[y][x] * operand;
      }
    }
    return new Matrix(this.w, this.h, values);
  }
};

Matrix.prototype.rowEchelon = function () {
  if (this.w <= this.h) {
    throw "Matrix rowEchelon size mismatch";
  }
  
  var temp = Matrix.cloneValues(this.values);

  // Do Gauss-Jordan algorithm.
  for (var yp = 0; yp < this.h; ++yp) {
    // Look up pivot value.
    var pivot = temp[yp][yp];
    while (pivot == 0) {
      // If pivot is zero, find non-zero pivot below.
      for (var ys = yp + 1; ys < this.h; ++ys) {
        if (temp[ys][yp] != 0) {
          // Swap rows.
          var tmpRow = temp[ys];
          temp[ys] = temp[yp];
          temp[yp] = tmpRow;
          break;
        }
      }
      if (ys == this.h) {
        // No suitable pivot found. Abort.
        return new Matrix(this.w, this.h, temp);
      }
      else {
        pivot = temp[yp][yp];        
      }
    };
    // Normalize this row.
    var scale = 1 / pivot;
    for (var x = yp; x < this.w; ++x) {
      temp[yp][x] *= scale;
    }
    // Subtract this row from all other rows (scaled).
    for (var y = 0; y < this.h; ++y) {
      if (y == yp) continue;
      var factor = temp[y][yp];
      temp[y][yp] = 0;
      for (var x = yp + 1; x < this.w; ++x) {
        temp[y][x] -= factor * temp[yp][x];
      }
    }
  }  
  return new Matrix(this.w, this.h, temp);
}

Matrix.prototype.invert = function () {
  if (this.w != this.h) {
    throw "Matrix invert size mismatch";
  }

  var temp = Matrix.allocate(this.w * 2, this.h);

  // Initialize augmented matrix
  for (var y = 0; y < this.h; ++y) {
    for (var x = 0; x < this.w; ++x) {
      temp[y][x] = this.values[y][x];
      temp[y][x + this.w] = (x == y) ? 1 : 0;
    }
  }
  
  temp = new Matrix(this.w * 2, this.h, temp);
  temp = temp.rowEchelon();
  
  // Extract right block matrix.
  var values = Matrix.allocate(this.w, this.h);
  for (var y = 0; y < this.w; ++y) {
    for (var x = 0; x < this.w; ++x) {
      values[y][x] = temp.values[y][x + this.w];
    }
  }
  return new Matrix(this.w, this.h, values);
};

Matrix.prototype.print = function () {
  var out = '<table class="matrix">';
  for (var y = 0; y < this.h; ++y) {
    out += '<tr>';
    for (var x = 0; x < this.w; ++x) {
      out += '<td>';
      out += Math.round(this.values[y][x] * 100.0) / 100.0;
      out += '</td>';
    }
    out += '</tr>';
  }
  out += '</table>';
  $('body').append(out);
  
  return this;
};

Matrix.prototype.toString = function () {
  var out = '[';
  for (var y = 0; y < this.h; ++y) {
    for (var x = 0; x < this.w; ++x) {
      out += Math.round(this.values[y][x] * 100.0) / 100.0;
      if (x != this.w - 1) {
          out += ' ';
      }
    }
    if (y != this.h - 1) {
        out += '\n';
    }
  }
  out += ']\n';

  return out;
};

// sum of squares of the matrix elements
Matrix.prototype.squareSum = function () {
    var sum = 0;
    for (var x  = 0; x < this.w; ++x) {
        for (var y = 0; y < this.h; ++y) {
            sum += Math.pow(this.values[y][x], 2);
        }
    }
    return sum;
}

// mean of the norms of the matrix columns
Matrix.prototype.meanNorm = function () {
    var sum = 0;
    for (var x  = 0; x < this.w; ++x) {
        var ysum = 0;
        for (var y = 0; y < this.h; ++y) {
            ysum += Math.pow(this.values[y][x], 2);
        }
        sum += Math.sqrt(ysum);
    }
    return sum / this.w;
}

// element-wise product, *not* matrix multiplication
Matrix.prototype.elementMultiply = function (operand) {
    if (this.w != operand.w || this.h != operand.h) {
        throw "Matrix product size mismatch";
    }

    var result = new Matrix(this.w, this.h);
    for (var y=0; y < this.h; ++y) {
        for (var x=0; x < this.w; ++x) {
            result.values[y][x] = this.values[y][x] * operand.values[y][x];
        }
    }
    return result;
}

// element-wise division
Matrix.prototype.elementDivide = function (operand) {
    if (this.w != operand.w || this.h != operand.h) {
        throw "Matrix product size mismatch";
    }

    var result = new Matrix(this.w, this.h);
    for (var y=0; y < this.h; ++y) {
        for (var x=0; x < this.w; ++x) {
            result.values[y][x] = this.values[y][x] / operand.values[y][x];
        }
    }
    return result;
}

// returns the mean of the columns of the matrix
Matrix.prototype.meanColumn = function () {
    var result = new Matrix(1, this.h);
    for (var y=0; y < this.h; ++y) {
        var sum = 0;
        for (var x=0; x < this.w; ++x) {
            sum += this.values[y][x];
        }
        result.values[y][0] = sum / this.w;
    }
    return result;
}

// returns the mean of the columns of the matrix
Matrix.prototype.meanRow = function () {
    var result = new Matrix(this.w, 1);
    for (var x=0; x < this.w; ++x) {
        var sum = 0;
        for (var y=0; y < this.h; ++y) {
            sum += this.values[y][x];
        }
        result.values[0][x] = sum / this.h;
    }
    return result;
}

Matrix.prototype.transpose = function () {
    var values = Matrix.allocate(this.h, this.w);
    for (var y = 0; y < this.h; ++y) {
        for (var x = 0; x < this.w; ++x) {
            values[x][y] = this.values[y][x];
        }
    }
    return new Matrix(this.h, this.w, values);
}

Matrix.prototype.tolist = function () {
    var result = [];
    for (var y = 0; y < this.h; ++y) {
        for (var x = 0; x < this.w; ++x) {
            result.push(this.values[y][x]);
        }
    }
    return result;
}

Matrix.prototype.flatten = function () {
    var result = new Matrix(1, this.w * this.h);
    for (var y = 0; y < this.h; ++y) {
        for (var x = 0; x < this.w; ++x) {
            result.values[y * this.w + x][0] = this.values[y][x];
        }
    }
    return result;
}
