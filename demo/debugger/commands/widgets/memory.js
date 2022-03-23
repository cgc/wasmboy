// Commands for memory

import { h } from 'preact';

import { Pubx } from 'pubx';

import { PUBX_KEYS } from '../../pubx.config';

import Command from '../command';

import MemoryViewer from '../../components/memory/viewer/viewer';
import MemoryTracer from '../../components/memory/tracer/tracer';

class MemoryViewerCommand extends Command {
  constructor() {
    super('memory:viewer');
    this.options.label = 'Viewer';
  }

  execute() {
    Pubx.get(PUBX_KEYS.WIDGET).addWidget({
      component: <MemoryViewer />,
      label: 'Memory Viewer'
    });
  }
}

class MemoryTracerCommand extends Command {
  constructor() {
    super('memory:tracer');
    this.options.label = 'Tracer';
  }

  execute() {
    Pubx.get(PUBX_KEYS.WIDGET).addWidget({
      component: <MemoryTracer />,
      label: 'Memory Tracer'
    });
  }
}

const exportedCommands = [new MemoryViewerCommand(), new MemoryTracerCommand()];
export default exportedCommands;
