import { parse } from "@babel/parser";

import { ICypressPost10Configuration } from "./cypress-post10-configuration";

export function parsePost10Configuration(
  source: string
): Partial<ICypressPost10Configuration> {
  const ast = parse(source, {
    sourceType: "unambiguous",
    plugins: ["typescript"],
  });

  console.log(JSON.stringify(ast));

  // module.exports = { specPattern: 'foo/bar' };
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
              return Object.fromEntries(
                right.properties.reduce<[string, string][]>(
                  (entries, property) => {
                    if (
                      property.type === "ObjectProperty" &&
                      property.key.type === "Identifier"
                    ) {
                      if (property.key.name === "specPattern") {
                        if (property.value.type === "StringLiteral") {
                          return [
                            ...entries,
                            ["specPattern", property.value.value],
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
      }
    }
  }

  // export default { specPattern: 'foo/bar' };
  if (ast.program.sourceType === "module") {
    for (const statement of ast.program.body) {
      if (
        statement.type === "ExportDefaultDeclaration" &&
        statement.exportKind === "value"
      ) {
        const { declaration } = statement;

        if (declaration.type === "ObjectExpression") {
          return Object.fromEntries(
            declaration.properties.reduce<[string, string][]>(
              (entries, property) => {
                if (
                  property.type === "ObjectProperty" &&
                  property.key.type === "Identifier"
                ) {
                  if (property.key.name === "specPattern") {
                    if (property.value.type === "StringLiteral") {
                      return [
                        ...entries,
                        ["specPattern", property.value.value],
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
  }

  return {};
}
