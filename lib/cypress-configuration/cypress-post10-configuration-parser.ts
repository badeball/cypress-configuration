import { parse } from "@babel/parser";

import { ObjectExpression } from "@babel/types";

export interface TestConfiguration {
  specPattern?: string | string[];
  env?: Record<string, any>;
}

export interface ConfigurationFile {
  e2e?: TestConfiguration;
  component?: TestConfiguration;
}

function parseEnv(object: ObjectExpression): Record<string, string> {
  return object.properties.reduce<Record<string, string>>((env, property) => {
    if (
      property.type === "ObjectProperty" &&
      property.key.type === "Identifier" &&
      property.value.type == "StringLiteral"
    ) {
      env[property.key.name] = property.value.value;
    }

    return env;
  }, {});
}

function parseTestingTypeObject(object: ObjectExpression): TestConfiguration {
  const test: TestConfiguration = {};

  for (const property of object.properties) {
    if (
      property.type === "ObjectProperty" &&
      property.key.type === "Identifier"
    ) {
      if (property.key.name === "specPattern") {
        if (property.value.type === "StringLiteral") {
          test.specPattern = property.value.value;
        } else if (property.value.type === "ArrayExpression") {
          test.specPattern = property.value.elements.map((element) => {
            if (element && element.type === "StringLiteral") {
              return element.value;
            } else {
              throw new Error(
                "Expected a string literal for specPattern.[], but got " +
                  element?.type ?? "null"
              );
            }
          });
        } else {
          throw new Error(
            "Expected a string literal for specPattern, but got " +
              property.value.type
          );
        }
      } else if (property.key.name === "env") {
        if (property.value.type === "ObjectExpression") {
          test.env = parseEnv(property.value);
        } else {
          throw new Error(
            "Expected a ObjectExpression for e2e, but got " +
              property.value.type
          );
        }
      }
    }
  }

  return test;
}

function parseTestingTypesObject(object: ObjectExpression): ConfigurationFile {
  const types: ConfigurationFile = {};

  for (const property of object.properties) {
    if (
      property.type === "ObjectProperty" &&
      property.key.type === "Identifier" &&
      property.value.type === "ObjectExpression"
    ) {
      if (property.key.name === "e2e") {
        types.e2e = parseTestingTypeObject(property.value);
      } else if (property.key.name === "component") {
        types.component = parseTestingTypeObject(property.value);
      }
    }
  }

  return types;
}

export function parsePost10Configuration(source: string): ConfigurationFile {
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
              const result = parseTestingTypesObject(right);

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
                  const result = parseTestingTypesObject(argument);

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
          const result = parseTestingTypesObject(declaration);

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
              const result = parseTestingTypesObject(argument);

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
