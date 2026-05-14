'use strict';

/* eslint mocha/no-synchronous-tests: "off", mocha/prefer-arrow-callback: "off" */

const assert = require('node:assert/strict');

const data = (key, value) => {
  if (typeof key === 'object') return key;
  if (!value || !value.dataset) return undefined;
  return value.dataset[key];
};
global.$ = Object.assign((value) => ({data: (key) => data(key, value)}), {
  each: (values, iterator) => {
    for (const [key, value] of Object.entries(values)) iterator(key, value);
  },
});

const stickyAttributes = require('../../../js/sticky_attributes');

describe('ep_sticky_attributes sticky line attributes', function () {
  it('maps align toolbar buttons to a sticky line attribute', function () {
    const result = stickyAttributes.getStickyLineAttributeFromButton({
      dataset: {key: 'alignCenter'},
    });
    assert.deepEqual(result, ['align', 'center']);
  });

  it('applies sticky alignment to the current line', function () {
    const calls = [];
    const changed = stickyAttributes.applyStickyLineAttributes({
      selStart: [3, 2],
      selEnd: [3, 2],
    }, {
      getAttributeOnLine: () => undefined,
      setAttributeOnLine: (line, attribute, value) => calls.push([line, attribute, value]),
    }, {
      lineAttributes: {align: 'right'},
    });
    assert.equal(changed, true);
    assert.deepEqual(calls, [[3, 'align', 'right']]);
  });

  it('does not reapply an existing sticky alignment', function () {
    const calls = [];
    const changed = stickyAttributes.applyStickyLineAttributes({
      selStart: [1, 0],
      selEnd: [1, 0],
    }, {
      getAttributeOnLine: () => 'left',
      setAttributeOnLine: (line, attribute, value) => calls.push([line, attribute, value]),
    }, {
      lineAttributes: {align: 'left'},
    });
    assert.equal(changed, false);
    assert.deepEqual(calls, []);
  });

  it('does not apply sticky line attributes while text is selected', function () {
    const calls = [];
    const changed = stickyAttributes.applyStickyLineAttributes({
      selStart: [1, 0],
      selEnd: [1, 4],
    }, {
      getAttributeOnLine: () => undefined,
      setAttributeOnLine: (line, attribute, value) => calls.push([line, attribute, value]),
    }, {
      lineAttributes: {align: 'justify'},
    });
    assert.equal(changed, false);
    assert.deepEqual(calls, []);
  });
});
