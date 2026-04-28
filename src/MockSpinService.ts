type SpinRequest = {
  balance: number;
  bet: number;
  freeSpinsRemaining: number;
};

type WinLine = {
  lineIndex: number;
  symbolIndex: number;
  count: number;
  payout: number;
};

type SpinResult = {
  reels: number[][];
  winLines: WinLine[];
  totalWin: number;
  balanceAfter: number;
  freeSpinsAwarded?: number;
  freeSpinsRemaining?: number;
};

export class MockSpinService {
  scatterIndex: number;
  wildIndex: number;
  config: any;

  constructor(config: any) {
    this.config = config;
    this.scatterIndex = config.symbols.indexOf("SCATTER");
    this.wildIndex = config.symbols.indexOf("WILD");
    this.validateConfig();
  }

  spin(request: SpinRequest): SpinResult {
    const isFreeSpin = request.freeSpinsRemaining > 0;
    const reels = this.createVisibleReels();
    const winLines = this.evaluateLines(reels, request.bet);
    const totalWin = winLines.reduce((sum, line) => sum + line.payout, 0);
    const scatterCount =  this.countScatters(reels, isFreeSpin);
    const freeSpinsAwarded =scatterCount >= this.config.freeSpinsTriggerCount? this.config.freeSpinsCount: undefined;
    const baseFreeSpinsRemaining = isFreeSpin? request.freeSpinsRemaining - 1: request.freeSpinsRemaining;
    const freeSpinsRemaining =baseFreeSpinsRemaining + (freeSpinsAwarded ?? 0);
    const balanceAfter =request.balance - (isFreeSpin ? 0 : request.bet) + totalWin;

    return {
      reels,
      winLines,
      totalWin,
      balanceAfter,
      freeSpinsAwarded,
      freeSpinsRemaining,
    };
  }

  createVisibleReels(): number[][] {
    if (this.config.forceMatrix) {
      return this.createForcedReels(this.config.forceMatrix);
    }

    return this.config.reelStrips.slice(0, this.config.reels).map((strip: string[]) => { // creates random symbols from the strips given in reelstrip from the config
      const startIndex = Math.floor(Math.random() * strip.length);
      const visible: number[] = [];

      for (let row = 0; row < this.config.rows; row++) {
        const symbol = strip[(startIndex + row) % strip.length];
        const symbolIndex = this.config.symbols.indexOf(symbol);

        visible.push(symbolIndex);
      }
      return visible;
    });
  }

  createForcedReels(forceMatrix: string[][]): number[][] {
    if (forceMatrix.length !== this.config.reels) {
      throw new Error("forceMatrix reel count does not match config.reels");
    }

    return forceMatrix.map((reel, reelIndex) => {
      if (reel.length !== this.config.rows) {
        throw new Error(`forceMatrix reel ${reelIndex} row count does not match config.rows`);
      }

      return reel.map((symbol) => {
        const symbolIndex = this.config.symbols.indexOf(symbol);

        if (symbolIndex < 0) {
          throw new Error(`Unknown symbol in forceMatrix: ${symbol}`);
        }

        return symbolIndex;
      });
    });
  }

  evaluateLines(reels: number[][], bet: number): WinLine[] {
    const lines: WinLine[] = [];

    for (let row = 0; row < this.config.rows; row++) {
      const symbolsOnLine = reels.map((reel) => reel[row]);
      const baseSymbolIndex = this.getBaseSymbolIndex(symbolsOnLine);

      if (baseSymbolIndex === undefined) {
        continue;
      }

      let count = 0;

      for (const symbolIndex of symbolsOnLine) {
        if (
          symbolIndex === baseSymbolIndex ||
          symbolIndex === this.wildIndex ||
          (baseSymbolIndex === this.wildIndex && symbolIndex !== this.scatterIndex)
        ) {
          count += 1;
          continue;
        }

        break;
      }

      if (count < 3) {
        continue;
      }

      const payout = bet * count;

      lines.push({
        lineIndex: row,
        symbolIndex: baseSymbolIndex,
        count,
        payout,
      });
    }

    return lines;
  }

  getBaseSymbolIndex(symbols: number[]): number | undefined {
    for (const symbolIndex of symbols) {
      if (symbolIndex === this.scatterIndex) {
        continue;
      }

      if (symbolIndex === this.wildIndex) {
        continue;
      }

      return symbolIndex;
    }

    const firstWild = symbols.find((symbolIndex) => symbolIndex === this.wildIndex);
    return firstWild;
  }

  countScatters(reels: number[][],isFreeSpin : boolean): number {
    let scatterCount = 0;

    if (isFreeSpin) { // stops retriggering freegames inside freegame
      return 0;
    }

    if (this.scatterIndex < 0) {
      return 0;
    }


    for (const reel of reels) {
      for (const symbolIndex of reel) {
        if (symbolIndex === this.scatterIndex) {
          scatterCount += 1;
        }
      }
    }

    return scatterCount;
  }

  getSymbolForIndex(symbolIndex: number): string {
    const symbol = this.config.symbols[symbolIndex];

    if (!symbol) {
      throw new Error(`Missing symbol for index: ${symbolIndex}`);
    }

    return symbol;
  }

  validateConfig(): void {
    if (!Array.isArray(this.config.reelStrips)) {
      throw new Error("config.reelStrips must be an array");
    }

    if (this.config.reelStrips.length < this.config.reels) {
      throw new Error(
        `config.reelStrips length (${this.config.reelStrips.length}) is less than config.reels (${this.config.reels})`,
      );
    }
  }
}
