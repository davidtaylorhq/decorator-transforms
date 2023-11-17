import { module, test } from "qunit";
import { oldBuild, newBuild, Builder } from "./helpers.ts";
import { type LegacyDecorator } from "../src/runtime.ts";
import * as runtime from "../src/runtime.ts";

function compatTests(title: string, build: Builder) {
  module(`${title}-ClassField`, () => {
    test("getter returning decorator", (assert) => {
      let log: any[] = [];

      let tracked: LegacyDecorator = function (_target, _prop, desc) {
        let value: any;
        let initialized = false;
        return {
          get() {
            if (!initialized) {
              initialized = true;
              value = desc.initializer?.();
            }
            return value;
          },
          set(newValue: any) {
            log.push(newValue);
            value = newValue;
          },
        };
      };

      let Example = build(
        `
        class Example {
          @tracked thing = 1;
        }
        `,
        { tracked, ...runtime }
      );
      let example = new Example();
      assert.strictEqual(example.thing, 1);
      example.thing = 2;
      assert.strictEqual(example.thing, 2);
      assert.deepEqual(log, [2]);
    });

    test("noop on undecorated class fields", (assert) => {
      let Example = build(
        `
        class Example {
          thing = 1;
        }
        `,
        {}
      );
      let example = new Example();
      assert.strictEqual(example.thing, 1);
      example.thing = 2;
      assert.strictEqual(example.thing, 2);
    });

    test("multiple decorator order", (assert) => {
      let log: any[] = [];

      function logAccess(message: string): LegacyDecorator {
        return function (_target, prop, desc) {
          let { initializer } = desc;
          let value: any;
          return {
            get() {
              log.push(`${message} ${prop}`);
              if (desc.get) {
                return desc.get();
              } else {
                if (initializer) {
                  value = initializer();
                  initializer = undefined;
                }
                return value;
              }
            },
          };
        };
      }

      let Example = build(
        `
        class Example {
          @logAccess('a') @logAccess('b') thing = 1;
        }
        `,
        { logAccess, ...runtime }
      );
      let example = new Example();
      assert.strictEqual(example.thing, 1);
      assert.deepEqual(log, [`a thing`, `b thing`]);
    });
  });

  test("value-returning decorator", (assert) => {
    let double: LegacyDecorator = function (_target, _prop, desc) {
      return {
        initializer: () => (desc.initializer ? desc.initializer() * 2 : 0),
      };
    };

    let Example = build(
      `
      class Example {
        @double thing = 3;
      }
      `,
      { double, ...runtime }
    );
    assert.strictEqual(new Example().thing, 6);
  });

  test("initializes value-returning decorator per instance", (assert) => {
    let noop: LegacyDecorator = function (_target, _prop, desc) {
      return desc;
    };

    let counter = 3;
    let Example = build(
      `
      class Example {
        @noop thing = counter++;
        @noop other = counter++;
      }
      `,
      { noop, counter, ...runtime }
    );
    let a = new Example();
    let b = new Example();
    assert.strictEqual(a.thing, 3);
    assert.strictEqual(a.other, 4);
    assert.strictEqual(b.thing, 5);
    assert.strictEqual(b.other, 6);
  });
}

compatTests("old-build", oldBuild);
compatTests("new-build", newBuild);
