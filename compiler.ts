import * as acorn from "acorn";
import * as walk from "acorn-walk";
import visitors, { run } from "./visitors";
import * as fs from "fs";

const code = fs.readFileSync(process.argv[2]).toString();
console.log(code);
const ast = acorn.parse(code, { ecmaVersion: 2020 });

walk.ancestor(ast, visitors);
run();
