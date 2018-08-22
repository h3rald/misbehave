import nodeResolve from 'rollup-plugin-node-resolve';
import commonjs    from 'rollup-plugin-commonjs';
import buble       from 'rollup-plugin-buble';
import filesize    from 'rollup-plugin-filesize';

module.exports = {
  input: 'index.js',
  output: {
    file: 'misbehave.js',
    format: 'es',
    name: 'Misbehave',
  },
  plugins    : [
    nodeResolve({ jsnext: true, main: true, browser: true }),
    commonjs({
      namedExports: {
        'node_modules/combokeys/Combokeys/index.js': ['Combokeys']
      }
    }),
    buble(),
    filesize()
  ]
};
