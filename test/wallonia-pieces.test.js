import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.window={PDFLib:{rgb:(...values)=>({values})}};
const {walloniaPieces:P}=await import('../regions/wallonia-pieces.js');

function fakePage(){
  return {
    getHeight:()=>842,
    drawText(){},
    drawRectangle(){},
    drawCircle(){},
  };
}

test('Wallonia piece helpers tolerate malformed persisted scalar values',()=>{
  const poison={toString:null};
  const page=fakePage();
  assert.doesNotThrow(()=>P.fieldLine(page,'Nom',poison,20,100));
  assert.doesNotThrow(()=>P.drawCombustiblesBlock(page,{fuelDetail:poison},20));
  assert.doesNotThrow(()=>P.drawDiagnosticTree(page,{},20,poison));
});
