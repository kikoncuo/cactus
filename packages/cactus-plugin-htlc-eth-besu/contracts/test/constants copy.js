
function birthday(val1, val2) {
  var counter = val1
  var res = 1
  let index
  console.log("Index "+(val1 - (val1-val2)))
 
  for (index = 0; index < (val1 - (val1-val2)); index++) {
      res = res * counter;
      counter = counter - 1;
  }
  console.log("Loops "+index)
  console.log("BeforeEstimation "+res)
  res = 1 - (res / Math.pow(val1, val2));
  console.log(100 * res);
}


birthday(100000000000000000000, 10000000);