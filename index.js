import { Editable } from './editable.js'
import { store } from './utils/store.js'
import { getSections } from './utils/selection.js'
import { js } from './behaviors/javascript.js'


export class Misbehave extends Editable {
  constructor(elem, opts = {}) {
    if (typeof opts.store === 'undefined') opts.store = store(getSections(elem))
    if (typeof opts.behavior === 'undefined') opts.behavior = js

    super(elem, opts)
  }
}
