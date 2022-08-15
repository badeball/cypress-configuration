import { parse } from "@babel/parser";

import { ObjectExpression } from "@babel/types";

import { ICypressPost10Configuration } from "./cypress-post10-configuration";

function parseThatObject(
  object: ObjectExpression
): Partial<ICypressPost10Configuration> | undefined {
  for (const property of object.properties) {
    if (
      property.type === "ObjectProperty" &&
      property.key.type === "Identifier" &&
      property.key.name === "e2e" &&
      property.value.type === "ObjectExpression"
    ) {
      return Object.fromEntries(
        property.value.properties.reduce<[string, string | string[]][]>(
          (entries, property) => {
            if (
              property.type === "ObjectProperty" &&
              property.key.type === "Identifier"
            ) {
              if (property.key.name === "specPattern") {
                if (property.value.type === "StringLiteral") {
                  return [...entries, ["specPattern", property.value.value]];
                } else if (property.value.type === "ArrayExpression") {
                  return [
                    ...entries,
                    [
                      "specPattern",
                      property.value.elements.map((element) => {
                        if (element && element.type === "StringLiteral") {
                          return element.value;
                        } else {
                          throw new Error(
                            "Expected a string literal for specPattern.[], but got " +
                              element?.type ?? "null"
                          );
                        }
                      }),
                    ],
                  ];
                } else {
                  throw new Error(
                    "Expected a string literal for specPattern, but got " +
                      property.value.type
                  );
                }
              } else {
                return entries;
              }
            } else {
              return entries;
            }
          },
          []
        )
      );
    }
  }
}

export function parsePost10Configuration(
  source: string
): Partial<ICypressPost10Configuration> {
  const ast = parse(source, {
    sourceType: "unambiguous",
    plugins: ["typescript"],
  });

  // module.exports = { e2e: { specPattern: "foo/bar" } };
  if (ast.program.sourceType === "script") {
    for (const statement of ast.program.body) {
      if (statement.type === "ExpressionStatement") {
        const { expression } = statement;

        if (
          expression.type === "AssignmentExpression" &&
          expression.operator === "="
        ) {
          const { left } = expression;

          if (
            left.type === "MemberExpression" &&
            left.object.type == "Identifier" &&
            left.object.name === "module" &&
            left.property.type === "Identifier" &&
            left.property.name === "exports"
          ) {
            const { right } = expression;

            if (right.type === "ObjectExpression") {
              const result = parseThatObject(right);

              if (result) {
                return result;
              }
            }
          }
        }
      }
    }
  }

  // module.exports = defineConfig({ e2e: { specPattern: "foo/bar" } });
  if (ast.program.sourceType === "script") {
    for (const statement of ast.program.body) {
      if (statement.type === "ExpressionStatement") {
        const { expression } = statement;

        if (
          expression.type === "AssignmentExpression" &&
          expression.operator === "="
        ) {
          const { left } = expression;

          if (
            left.type === "MemberExpression" &&
            left.object.type == "Identifier" &&
            left.object.name === "module" &&
            left.property.type === "Identifier" &&
            left.property.name === "exports"
          ) {
            const { right } = expression;

            if (right.type === "CallExpression") {
              const {
                callee,
                arguments: [argument],
              } = right;

              if (
                callee.type === "Identifier" &&
                callee.name === "defineConfig"
              ) {
                if (argument && argument.type === "ObjectExpression") {
                  const result = parseThatObject(argument);

                  if (result) {
                    return result;
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  // export default { e2e: { specPattern: "foo/bar" } };
  if (ast.program.sourceType === "module") {
    for (const statement of ast.program.body) {
      if (
        statement.type === "ExportDefaultDeclaration" &&
        statement.exportKind === "value"
      ) {
        const { declaration } = statement;

        if (declaration.type === "ObjectExpression") {
          const result = parseThatObject(declaration);

          if (result) {
            return result;
          }
        }
      }
    }
  }

  // export default defineConfig({ e2e: { specPattern: "foo/bar" } });
  if (ast.program.sourceType === "module") {
    for (const statement of ast.program.body) {
      if (
        statement.type === "ExportDefaultDeclaration" &&
        statement.exportKind === "value"
      ) {
        const { declaration } = statement;

        if (declaration.type === "CallExpression") {
          const {
            callee,
            arguments: [argument],
          } = declaration;

          if (callee.type === "Identifier" && callee.name === "defineConfig") {
            if (argument && argument.type === "ObjectExpression") {
              const result = parseThatObject(argument);

              if (result) {
                return result;
              }
            }
          }
        }
      }
    }
  }

  return {};
}
