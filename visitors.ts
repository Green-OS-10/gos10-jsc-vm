import * as acorn from "acorn";

enum Instruction {
  PUSH,
  GET,
  SET,
  FREE,
  CALCULATE,
  ARRAY,
  ACCESS,
  UPDATE,
  // COPY,
}

enum BinaryOperations {
  "+",
  "-",
  "*",
  "/",
  "%",
}

const bytecode: any[] = [];
const symbols: string[] = [];
const blocks: { stack: number; heap: number }[] = [];
let heapPointer = 0;

function Literal(node: acorn.Literal) {
  bytecode.push(Instruction.PUSH, node.value);
}

function Identifier(
  node: acorn.Identifier,
  _state: any,
  ancestors: acorn.Node[]
) {
  bytecode.push(Instruction.GET, symbols.lastIndexOf(node.name));
}

function MemberExpression(
  node: acorn.MemberExpression,
  _state: any,
  ancestors: acorn.Node[]
) {
  if (
    ancestors[ancestors.length - 2].type === "AssignmentExpression" &&
    (ancestors[ancestors.length - 2] as acorn.AssignmentExpression).left ===
      node
  ) {
    if (ancestors[ancestors.length - 3].type !== "ExpressionStatement") {
      bytecode.push(Instruction.GET, symbols.length);
      bytecode.push(Instruction.GET, symbols.length + 1);
    }
  } else {
    bytecode.push(Instruction.ACCESS);
  }
}

function BinaryExpression(node: acorn.BinaryExpression) {
  bytecode.push(
    Instruction.CALCULATE,
    BinaryOperations[node.operator as keyof typeof BinaryOperations]
  );
}

function ArrayExpression(node: acorn.ArrayExpression) {
  bytecode.push(Instruction.ARRAY, node.elements.length);
}

function AssignmentExpression(
  node: acorn.AssignmentExpression,
  _state: any,
  ancestors: acorn.Node[]
) {
  if (node.left.type === "MemberExpression") {
    if (["+", "-", "*", "/", "%"].includes(node.operator[0])) {
      bytecode.push(Instruction.GET, symbols.length);
      bytecode.push(Instruction.GET, symbols.length + 1);
      bytecode.push(Instruction.ACCESS);
      bytecode.push(
        Instruction.CALCULATE,
        BinaryOperations[node.operator[0] as keyof typeof BinaryOperations]
      );
    }
    bytecode.push(Instruction.UPDATE);
    if (ancestors[ancestors.length - 2].type !== "ExpressionStatement") {
      bytecode.push(Instruction.ACCESS);
    }
    return;
  }
  const symbol = symbols.lastIndexOf((node.left as acorn.Identifier).name);
  if (["+", "-", "*", "/", "%"].includes(node.operator[0])) {
    bytecode.push(Instruction.GET, symbol);
    bytecode.push(
      Instruction.CALCULATE,
      BinaryOperations[node.operator[0] as keyof typeof BinaryOperations]
    );
    bytecode.push(Instruction.SET, symbol);
  }
}

function VariableDeclaration(node: acorn.VariableDeclaration) {
  for (const declaration of node.declarations) {
    symbols.push((declaration.id as acorn.Identifier).name);
    if (declaration.init!.type === "ArrayExpression") heapPointer++;
  }
}

function UpdateExpression(
  node: acorn.UpdateExpression,
  _state: any,
  ancestors: acorn.Node[]
) {
  if (node.argument.type === "MemberExpression") {
    if (["+", "-", "*", "/", "%"].includes(node.operator[0])) {
      bytecode.push(Instruction.GET, symbols.length);
      bytecode.push(Instruction.GET, symbols.length + 1);
      bytecode.push(Instruction.ACCESS);
      bytecode.push(
        Instruction.CALCULATE,
        BinaryOperations[node.operator[0] as keyof typeof BinaryOperations]
      );
    }
    bytecode.push(Instruction.UPDATE);
    if (ancestors[ancestors.length - 2].type !== "ExpressionStatement") {
      bytecode.push(Instruction.ACCESS);
    }
    return;
  }
  const symbol = symbols.lastIndexOf((node.argument as acorn.Identifier).name);
  if (["+", "-", "*", "/", "%"].includes(node.operator[0])) {
    bytecode.push(Instruction.GET, symbol);
    bytecode.push(
      Instruction.CALCULATE,
      BinaryOperations[node.operator[0] as keyof typeof BinaryOperations]
    );
    bytecode.push(Instruction.SET, symbol);
  }
}

function BlockStatement(
  node: acorn.BlockStatement,
  _state: any,
  ancestors: acorn.Node[]
) {
  const start = blocks.pop()!;
  symbols.splice(start.stack, symbols.length - start.stack);
  heapPointer = start.heap;
  bytecode.push(Instruction.FREE, start.stack, heapPointer);
}

function ExpressionStatement(
  node: acorn.ExpressionStatement,
  _state: any,
  ancestors: acorn.Node[]
) {
  if (node.expression.type !== "AssignmentExpression") {
    bytecode.push(Instruction.FREE, symbols.length, heapPointer);
  }
}

function checkBlock(node: acorn.Node, _state: any, ancestors: acorn.Node[]) {
  if (
    ancestors[ancestors.length - 2].type === "BlockStatement" &&
    (ancestors[ancestors.length - 2] as acorn.BlockStatement).body[0] === node
  ) {
    blocks.push({ stack: symbols.length - 1, heap: heapPointer - 1 });
  }
}

export default Object.fromEntries(
  [
    Literal,
    Identifier,
    BinaryExpression,
    ArrayExpression,
    MemberExpression,
    AssignmentExpression,
    VariableDeclaration,
    UpdateExpression,
    BlockStatement,
    ExpressionStatement,
  ].map((visitor) => [
    visitor.name,
    (node: any, state: any, ancestors: acorn.Node[]) => {
      visitor(node, state, ancestors);
      checkBlock(node, state, ancestors);
    },
  ])
);

export function run() {
  let stack: any[] = [];
  const heap: any[] = [];
  const heapPointers: number[] = [];
  console.log(bytecode);
  let i = 0;
  const length = 20;
  console.log(
    [
      "Instruction".padEnd(length),
      "Stack".padEnd(length),
      "Heap Pointers".padEnd(length),
      "Heap",
    ].join("    ")
  );
  console.log(
    "-"
      .repeat(length)
      .padEnd(length + 4)
      .repeat(4)
  );
  while (i < bytecode.length) {
    const instruction = bytecode[i++];
    const log = (msg: string | undefined = undefined) => {
      const instructionString = [Instruction[instruction], msg]
        .join(" ")
        .padEnd(length);
      const stackString = JSON.stringify(stack).padEnd(length);
      const heapPointersString = JSON.stringify(heapPointers).padEnd(length);
      const heapString = JSON.stringify(heap);
      console.log(
        [
          instructionString.slice(0, length),
          stackString.slice(-length, stackString.length),
          heapPointersString.slice(-length, heapPointersString.length),
          heapString.slice(-length, heapString.length),
        ].join("    ")
      );
    };
    switch (instruction) {
      case Instruction.PUSH: {
        stack.push(bytecode[i++]);
        log(`${bytecode[i - 1]}`);
        break;
      }
      case Instruction.GET: {
        stack.push(stack[bytecode[i++]]);
        log(`#${bytecode[i - 1]}`);
        break;
      }
      case Instruction.SET: {
        const value = stack.pop();
        stack[bytecode[i++]] = value;
        log(`#${bytecode[i - 1]} ${value}`);
        break;
      }
      case Instruction.FREE: {
        const symbol = bytecode[i++];
        stack.splice(symbol, stack.length - symbol);
        const reference = bytecode[i++];
        const pointer = heapPointers[reference];
        heap.splice(pointer, heap.length - pointer);
        heapPointers.splice(reference, heapPointers.length - reference);
        log(`#${symbol} *${reference}`);
        break;
      }
      case Instruction.ARRAY: {
        const length = bytecode[i++];
        const array = stack.splice(stack.length - length, length);
        heapPointers.push(heap.length);
        heap.push(length, ...array);
        stack.push(heapPointers.length - 1);
        log(`{${array.join(",")}}`);
        break;
      }
      case Instruction.ACCESS: {
        const index = stack.pop();
        const reference = stack.pop();
        const pointer = heapPointers[reference];
        stack.push(heap[pointer + index + 1]);
        log(`#${reference}[${index}]`);
        break;
      }
      case Instruction.UPDATE: {
        const value = stack.pop();
        const index = stack.pop();
        const reference = stack.pop();
        const pointer = heapPointers[reference];
        heap[pointer + index + 1] = value;
        log(`#${reference}[${index}] ${value}`);
        break;
      }
      // case Instruction.COPY: {
      //   const length = bytecode[i++];
      //   const offset = bytecode[i++];
      //   const insertOffset = bytecode[i++];
      //   const array = stack.slice(
      //     stack.length - length - offset,
      //     stack.length - offset
      //   );
      //   stack = stack
      //     .slice(0, stack.length - insertOffset)
      //     .concat(...array)
      //     .concat(stack.slice(stack.length - insertOffset, stack.length));
      //   log(`{${array.join(",")}}`);
      //   break;
      // }
      case Instruction.CALCULATE: {
        const right = stack.pop();
        const left = stack.pop();
        stack.push(
          {
            "+": left + right,
            "-": left - right,
            "*": left * right,
            "/": left / right,
            "%": left % right,
          }[BinaryOperations[bytecode[i++]]]
        );
        log(`${left} ${BinaryOperations[bytecode[i - 1]]} ${right}`);
        break;
      }
    }
  }
}
