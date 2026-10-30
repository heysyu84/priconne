// Retained algorithms from the original interface; UI integration lives in src/.
export {assignSupports,planThreeAttacks,characterKey} from './compat/combo-planner.mjs';
export {shiftExternalTacticTimes,parseExternalCarryTime} from './compat/external-tactic-carry.mjs';
export {createBattleImageImport} from './compat/battle-image-import.mjs?v=20261026-ocr-regions09';
export * from './compat/battle-image-parser.mjs';
export {readCarryWorkbook} from './compat/carry-sheet-xlsx.mjs';
export {convertCarryWorkbook,carryTacticBody,carryTacticMetadata,carryTacticPaste} from './compat/carry-sheet-converter.mjs';
export {parseTacticTransfer,serializeTacticTransfer,resolveTacticSlots} from './compat/tactic-transfer.mjs';
export {richLine,colorRuns,pastedRows,replaceTacticRowText,recalculateTacticRows,commandState} from './compat/tactics-model.mjs?v=20261030-except01';

