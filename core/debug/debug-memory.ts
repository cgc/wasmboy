// Functions to debug internal gameboy memory
// Great for disassembelr
import {
  DEBUG_GAMEBOY_MEMORY_LOCATION,
  DEBUG_GAMEBOY_MEMORY_SIZE,
  CARTRIDGE_ROM_LOCATION,
  CARTRIDGE_ROM_SIZE,
  CARTRIDGE_RAM_LOCATION,
  CARTRIDGE_RAM_SIZE,
  DEBUG_TRACE_RAM_LOCATION,
  DEBUG_TRACE_ROM_LOCATION,
  DEBUG_TRACE_GAMEBOY_MEMORY_LOCATION
} from '../constants';
import { eightBitLoadFromGBMemoryWithTraps } from '../memory/index';
import { Breakpoints } from './breakpoints';
import { getRomBankAddress, getRamBankAddress } from '../memory/banking';
import { getWasmBoyOffsetFromGameBoyOffset } from '../memory/memoryMap';

function writeTrace(gameboyOffset: i32, value: u8): void {
  const wasmOffset = getWasmBoyOffsetFromGameBoyOffset(gameboyOffset);
  let offset = DEBUG_TRACE_GAMEBOY_MEMORY_LOCATION + gameboyOffset;
  if (CARTRIDGE_ROM_LOCATION <= wasmOffset && wasmOffset < CARTRIDGE_ROM_LOCATION + CARTRIDGE_ROM_SIZE) {
    offset = DEBUG_TRACE_ROM_LOCATION + wasmOffset - CARTRIDGE_ROM_LOCATION;
  } else if (CARTRIDGE_RAM_LOCATION <= wasmOffset && wasmOffset < CARTRIDGE_RAM_LOCATION + CARTRIDGE_RAM_SIZE) {
    offset = DEBUG_TRACE_RAM_LOCATION + wasmOffset - CARTRIDGE_RAM_LOCATION;
  }

  const original = load<u8>(offset);
  store<u8>(offset, original | value);
}

export function traceExec(gameboyOffset: i32): void {
  writeTrace(gameboyOffset, 0x2);
}

export function traceLoad(gameboyOffset: i32): void {
  writeTrace(gameboyOffset, 0x1);
}

export function traceStore(gameboyOffset: i32): void {
  writeTrace(gameboyOffset, 0x4);
}

export function updateDebugGBMemory(): void {
  for (let i: i32 = 0; i < DEBUG_GAMEBOY_MEMORY_SIZE; i++) {
    store<u8>(DEBUG_GAMEBOY_MEMORY_LOCATION + i, eightBitLoadFromGBMemoryWithTraps(i));
  }

  // Since we are debugging, we don't want to be responsible for tripping the breakpoints
  Breakpoints.reachedBreakpoint = false;
}
