/**
 * Token Strategy Factory
 * 
 * SOLID: Open/Closed — to add a 3rd distribution mode, just add a new
 * ITokenStrategy implementation and a branch here. Zero changes to use cases.
 * 
 * SOLID: Dependency Inversion — use cases receive ITokenStrategy, not 
 * concrete strategies. This factory is called only at the composition root.
 */

import { ITokenStrategy } from './ITokenStrategy';
import { AdvancedTokenStrategy } from './AdvancedTokenStrategy';
import { ClassicTokenStrategy } from './ClassicTokenStrategy';
import { TokenGeneratorService } from './TokenGeneratorService';

export type TokenDistribution = 'classic' | 'advanced';

export class TokenStrategyFactory {
  constructor(
    private classicStrategy: ITokenStrategy,
    private advancedStrategy: ITokenStrategy
  ) {}

  create(distribution: TokenDistribution | undefined): ITokenStrategy {
    switch (distribution) {
      case 'classic':
        return this.classicStrategy;
      case 'advanced':
      default:
        return this.advancedStrategy;
    }
  }
}
