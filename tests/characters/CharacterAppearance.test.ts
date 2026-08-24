import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  generateCharacterAppearance,
  getModelAppearance,
  getPortraitLayers,
  getVisibleSubsets,
  isAppearanceValidForRace,
} from '../../src/characters/CharacterAppearance';
import {
  BUILDER, RAIDER, RACE_HUMAN, RACE_SHAMON, RACE_TOBIAN, SCIENTIST,
} from '../../src/characters/CharacterConstants';

describe('Lua character appearance parity', () => {
  it('keeps a coherent fat female human body, head, hair, and portrait tuple', () => {
    const appearance = generateCharacterAppearance(RACE_HUMAN, () => 0.999999);
    expect(appearance).toMatchObject({
      nBodyVariation: 41,
      nHeadVariation: 41,
      nHairVariation: 85,
      nFaceBottomVariation: 0,
      sPortrait: 'Human_Large_Female_Black_02',
      sPortraitHair: 'Human_Large_Female_02_Hair_Gray_01',
    });
    expect(appearance.sPortraitFacialHair).toBeUndefined();

    const model = getModelAppearance({ nRace: RACE_HUMAN, ...appearance });
    expect(model).toMatchObject({
      rig: 'base', sex: 'F', fat: true,
      bodySubset: 11, bodyTexture: 'Human_Body_Female01_base_05',
      headSubset: 3, headTexture: 'Human_Head_Female01_base_05',
      hair: { subset: 16, texture: 'Hair_Long01_Color_07', portraitColor: 'Gray' },
    });
    expect(getPortraitLayers({ nRace: RACE_HUMAN, ...appearance })).toEqual([
      'Human_Large_Female_Black_02.png',
      'Human_Large_Female_02_Hair_Gray_01.png',
    ]);
  });

  it('selects the original Tobian primitive and texture variants', () => {
    const appearance = generateCharacterAppearance(RACE_TOBIAN, () => 0.5);
    expect(appearance).toMatchObject({
      nBodyVariation: 17,
      nHeadVariation: 17,
      nHairVariation: 16,
      sPortrait: 'TobianEyestalkMustacheHead_Male_Light_Blue_02',
    });
    expect(isAppearanceValidForRace({ nRace: RACE_TOBIAN, ...appearance })).toBe(true);

    const selected = getVisibleSubsets({ nRace: RACE_TOBIAN, ...appearance }, SCIENTIST);
    expect([...selected.indices].sort((a, b) => a - b)).toEqual([0, 3, 4, 9]);
    expect(selected.textures).toEqual(new Map([
      [0, 'Alien_Body01_base_03'],
      [4, 'Alien_Head01_base_03'],
      [3, 'Moustache01_Hair01_base_03'],
      [9, 'Scientist01'],
    ]));
  });

  it('does not mount helmets absent from the Lua head job map', () => {
    const human = generateCharacterAppearance(RACE_HUMAN, () => 0);
    expect(getVisibleSubsets({ nRace: RACE_HUMAN, ...human }, RAIDER).indices.has(88)).toBe(false);

    const shamon = generateCharacterAppearance(RACE_SHAMON, () => 0);
    expect(getVisibleSubsets({ nRace: RACE_SHAMON, ...shamon }, BUILDER).indices.has(83)).toBe(false);
  });

  it('only generates portrait layers present in the extracted source atlas', () => {
    let state = 0x5eed1234;
    const random = () => {
      state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
      return state / 0x1_0000_0000;
    };
    for (let race = 1; race <= 10; race++) {
      for (let i = 0; i < 250; i++) {
        const appearance = generateCharacterAppearance(race, random);
        for (const layer of getPortraitLayers({ nRace: race, ...appearance })) {
          expect(existsSync(resolve('public/assets/ui/portraits', layer)), layer).toBe(true);
        }
      }
    }
  });
});
