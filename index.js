import { Editable } from './editable.js'
import { store } from './utils/store.js'
import { getSections } from './utils/selection.js'
import { JsBehavior } from './behaviors/javascript/index.js'


export class Misbehave extends Editable {
  constructor(elem, opts = {}) {
    if (typeof opts.store === 'undefined') opts.store = store(getSections(elem))
    if (typeof opts.behavior === 'undefined') opts.behavior = JsBehavior

    super(elem, opts)
  }
}
