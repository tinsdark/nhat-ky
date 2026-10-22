// Dev-only: use the data layer and sync from the browser console (window.nk) until the real screens exist.
import * as repo from '../data/repository'
import { engine } from '../sync'
import { addPersonaMonth, clearFakeData } from './panel'

Object.assign(window, { nk: { ...repo, sync: engine, addPersonaMonth, clearFakeData } })
