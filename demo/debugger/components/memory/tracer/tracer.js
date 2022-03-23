import { h, Component, createRef } from 'preact';

import { Pubx } from 'pubx';
import { PUBX_KEYS } from '../../../pubx.config';

import { WasmBoy } from '../../../wasmboy';

import InputSubmit from '../../inputSubmit';

import VirtualList from '../../virtualList';

import { virtualListWidgetScrollToAddress } from '../../virtualListWidget';

import './tracer.css';

async function clearTracingMemory() {
  const start = await WasmBoy._getWasmConstant('DEBUG_TRACE_RAM_LOCATION');
  const end =
    (await WasmBoy._getWasmConstant('DEBUG_TRACE_GAMEBOY_MEMORY_LOCATION')) +
    (await WasmBoy._getWasmConstant('DEBUG_TRACE_GAMEBOY_MEMORY_SIZE'));

  await WasmBoy.clearMemoryRegion(start, end);
}

const ROM_BANK_SIZE = Math.pow(2, 14);
const RAM_BANK_SIZE = Math.pow(2, 13);

const TRACE_TO_COLOR = [
  [200, 200, 200], // black for 0x0
  [24, 63, 238], // blue for load
  [90, 197, 70], // green for exec
  [], // load + exec
  [228, 60, 35], // red for store
  [255, 128, 255], // purple for load + store
  [], // exec + store
  [] // exec + load + store
];

class TraceCache {
  constructor(locationName, sizeName, { bankSize, size, offset = 0, emuBankName } = {}) {
    this.locationName = locationName;
    this.sizeName = sizeName;
    this.bankSize = bankSize;
    this.size = size;
    this.offset = offset;
    this.emuBankName = emuBankName;
    this.ready = false;
  }

  async update() {
    if (!this.start) {
      this.start = this.offset + (await WasmBoy._getWasmConstant(this.locationName));
      this.size = this.size || (await WasmBoy._getWasmConstant(this.sizeName));
      this.bankSize = this.bankSize || this.size;
      this.end = this.start + this.size;
    }
    this.data = await WasmBoy._getWasmMemorySection(this.start, this.end);

    // summarize bank state
    this.bankSummary = [];
    const bankCount = this.data.length / this.bankSize;
    for (let bank = 0; bank < bankCount; bank++) {
      const offset = bank * this.bankSize;
      let marked = 0;
      for (let i = 0; i < this.bankSize; i++) {
        if (this.data[offset + i] != 0) {
          marked++;
        }
      }
      this.bankSummary.push({ bank, marked, markedFraction: marked / this.bankSize });
    }

    if (this.emuBankName) {
      this.emuBank = await WasmBoy._runWasmExport(this.emuBankName);
    }

    this.ready = true;
  }
}

class MemoryTrace extends Component {
  canvasRef = createRef();

  constructor() {
    super();
    this.state.currentBank = 0;
    this.ctx = null;
  }

  setCurrentBank(bank) {
    this.setState({ currentBank: bank });
    this.drawCurrentBank();
  }

  drawCurrentBank() {
    const c = this.canvasRef.current;
    if (!c) {
      this.ctx = null;
      return;
    }

    if (!this.ctx) {
      // do setup
      this.ctx = c.getContext('2d');
      this.im = new ImageData(c.width, c.height);
    }

    const imData = this.im.data;

    const tc = this.props.traceCache;
    for (let i = 0; i < tc.bankSize; i++) {
      const memoryIndex = i + tc.bankSize * this.state.currentBank;
      const imIndex = i << 2;
      const c = TRACE_TO_COLOR[tc.data[memoryIndex]];
      imData[imIndex + 0] = c[0];
      imData[imIndex + 1] = c[1];
      imData[imIndex + 2] = c[2];
      imData[imIndex + 3] = 0x255;
    }
    this.ctx.putImageData(this.im, 0, 0);
  }

  onMouseMove = evt => {
    const c = this.canvasRef.current;
    if (!c) {
      return;
    }
    const rect = c.getBoundingClientRect();
    // https://stackoverflow.com/questions/17130395/real-mouse-position-in-canvas
    const scaleX = c.width / rect.width;
    const scaleY = c.height / rect.height;
    // Rounding down to be centered in appropriate pixel.
    // Ensuring values are at least 0 to avoid issues at boundaries with fractional offsets.
    // HACK rounding isn't right !!!!
    //const x = Math.max(0, Math.floor((evt.clientX - rect.left) * scaleX));
    //const y = Math.max(0, Math.floor((evt.clientY - rect.top) * scaleY));
    const x = Math.floor((evt.clientX - rect.left) * scaleX);
    const y = Math.floor((evt.clientY - rect.top) * scaleY);

    const offset = Math.round(y * c.width + x);
    this.setState({ offset });
  };

  onMouseLeave = () => {
    this.setState({ offset: null });
  };

  render() {
    const tc = this.props.traceCache;

    const banks = this.props.hideBankSelector
      ? null
      : tc.bankSummary.map(s => {
          const iscurr = s.bank == this.state.currentBank;
          // filtering out non-current, non-marked banks
          if (s.marked == 0 && !iscurr) {
            return;
          }
          const c = 55 + 200 * (1 - s.markedFraction);
          const m = s.marked ? `background: rgb(255, ${c}, ${c})` : '';
          const emuBank = tc.emuBank == s.bank ? 'MemoryTracer-Viewer-emuBank' : '';
          return (
            <button className={emuBank} key={s.bank} disabled={iscurr} onClick={() => this.setCurrentBank(s.bank)} style={m}>
              {s.bank.toString(16).padStart(2, '0')}
            </button>
          );
        });

    const w = this.props.width || 128;
    return (
      <div>
        <div className="MemoryTracer-Viewer">
          <div className="MemoryTracer-Viewer-banks">
            {banks}
            <div>{this.state.offset ? <span>Offset 0x{this.state.offset.toString(16).padStart(4, '0')}</span> : <span></span>}</div>
          </div>
          <div className="MemoryTracer-Viewer-canvas">
            <canvas
              ref={this.canvasRef}
              width={w}
              height={tc.bankSize / w}
              style={`width: 100%; image-rendering: pixelated`}
              onMouseMove={this.onMouseMove}
              onMouseLeave={this.onMouseLeave}
            />
          </div>
        </div>
      </div>
    );
  }
}

export default class MemoryTracer extends Component {
  refRAM = createRef();
  refROM = createRef();
  refGB = createRef();

  constructor() {
    super();
    this.updateTimeout = false;

    this.state.wasmboy = {};
    this.state.loading = {};
  }

  componentDidMount() {
    //this.ready = false;
    this.unsubLoading = Pubx.subscribe(PUBX_KEYS.LOADING, newState => this.setState({ loading: newState }));
    this.unsubWasmBoy = Pubx.subscribe(PUBX_KEYS.WASMBOY, newState => {
      this.setState({ wasmboy: newState });
      this.update();
    });
    this.setState({
      loading: Pubx.get(PUBX_KEYS.LOADING),
      wasmboy: Pubx.get(PUBX_KEYS.WASMBOY)
    });

    const updateLoop = () => {
      this.updateTimeout = setTimeout(() => {
        if (!this.state.running && (!this.state.wasmboy.ready || !this.state.wasmboy.playing)) {
          updateLoop();
          return;
        }

        this.update().then(() => {
          if (this.updateTimeout) {
            updateLoop();
          }
        });
      }, 250);
    };
    updateLoop();
  }

  componentWillUnmount() {
    if (!this.unsubLoading) {
      this.unsubLoading();
    }
    if (!this.unsubWasmBoy) {
      this.unsubWasmBoy();
    }

    // CLean up, and try to get the updateTask out of memory
    clearTimeout(this.updateTimeout);
    this.updateTimeout = false;
  }

  update() {
    if (!WasmBoy.isReady()) {
      return Promise.resolve();
    }

    // compute ROM/RAM sizes
    // from https://gbdev.io/pandocs/The_Cartridge_Header.html
    const cart = this.state.wasmboy.cartridge;
    const romSize = Math.pow(2, 15) << cart.ROMSize;
    const ramSize = [0, null, 1 * RAM_BANK_SIZE, 4 * RAM_BANK_SIZE, 16 * RAM_BANK_SIZE, 8 * RAM_BANK_SIZE][cart.RAMSize];

    if (!romSize || !ramSize) {
      return;
    }

    if (!this.views) {
      this.views = [
        {
          name: 'ROM',
          tc: new TraceCache('DEBUG_TRACE_ROM_LOCATION', 'DEBUG_TRACE_ROM_SIZE', {
            bankSize: ROM_BANK_SIZE,
            size: romSize,
            emuBankName: 'getCurrentRomBank'
          })
        },
        {
          name: 'GB (VRAM 0x8000-0x9FFF)',
          tc: new TraceCache('DEBUG_TRACE_GAMEBOY_MEMORY_LOCATION', null, { size: 0x2000, offset: 0x8000 }),
          hideBankSelector: true
        },
        {
          name: 'GB (WRAM 0xC000-0xDFFF)',
          tc: new TraceCache('DEBUG_TRACE_GAMEBOY_MEMORY_LOCATION', null, { size: 0x2000, offset: 0xc000 }),
          hideBankSelector: true
        },
        {
          name: 'GB (IO/HRAM 0xFF00-0xFFFF)',
          tc: new TraceCache('DEBUG_TRACE_GAMEBOY_MEMORY_LOCATION', null, { size: 0x0100, offset: 0xff00 }),
          hideBankSelector: true,
          width: 32
        },
        {
          name: 'RAM',
          tc: new TraceCache('DEBUG_TRACE_RAM_LOCATION', 'DEBUG_TRACE_RAM_SIZE', {
            bankSize: RAM_BANK_SIZE,
            size: ramSize,
            emuBankName: 'getCurrentRomBank'
          })
        }
      ];
      this.views.forEach(v => (v.ref = createRef()));
    }

    return Promise.all(this.views.map(v => v.tc.update())).then(() => {
      for (const v of this.views) {
        if (!v.ref.current) {
          break;
        }
        v.ref.current.drawCurrentBank();
      }
      // HACK TODO: is this enough to ensure children buttons are refreshed?
      // Need to re-render to pass data :p
      this.setState({});
    });
  }

  async clearTracingMemory() {
    await clearTracingMemory();
    await this.update();
  }

  render() {
    const viewsReady = this.views && this.views[0].tc.ready;
    if (!this.state.wasmboy.ready || !viewsReady) {
      return <i>Please Load a ROM to view GB Memory.</i>;
    }

    const traces = this.views.map(v => {
      return (
        <div key={v.name}>
          <h3>{v.name}</h3>
          <div>
            <MemoryTrace traceCache={v.tc} {...v} />
          </div>
        </div>
      );
    });

    return (
      <div className="MemoryTracer">
        <div className="MemoryTracer-clearButton">
          <button onClick={() => this.clearTracingMemory()}>Reset tracking</button>
        </div>
        {traces}
      </div>
    );
  }
}
