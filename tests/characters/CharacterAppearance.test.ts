import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  generateCharacterAppearance,
  getModelAppearance,
  getPortraitLayers,
  getVisibleSubsets,
  isAppearanceValidForRace,
} from '../../src/characters/CharacterAppearance';
import {
  BUILDER, RAIDER, RACE_CHICKEN, RACE_HUMAN, RACE_SHAMON, RACE_TOBIAN, SCIENTIST,
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
      hair: { subset: 17, texture: 'Hair_Long01_Color_07', portraitColor: 'Gray' },
    });
    expect(getPortraitLayers({ nRace: RACE_HUMAN, ...appearance })).toEqual([
      'Human_Large_Female_Black_02.png',
      'Human_Large_Female_02_Hair_Gray_01.png',
    ]);
  });

  it('uses the exact Citizen_Base primitive order for all female hair silhouettes', () => {
    const appearance = generateCharacterAppearance(RACE_HUMAN, () => 0.999999);
    expect(getModelAppearance({ nRace: RACE_HUMAN, ...appearance, nHairVariation: 4 }).hair?.subset).toBe(18);
    expect(getModelAppearance({ nRace: RACE_HUMAN, ...appearance, nHairVariation: 5 }).hair?.subset).toBe(19);
    expect(getModelAppearance({ nRace: RACE_HUMAN, ...appearance, nHairVariation: 8 }).hair?.subset).toBe(17);
  });

  it('generates and mounts Lua accessory pools, textures, and job conflicts', () => {
    const appearance = generateCharacterAppearance(RACE_HUMAN, () => 0);
    expect(appearance).toMatchObject({
      nBodyVariation: 1,
      nBottomAccessoryVariation: 1,
      nTopAccessoryVariation: 2,
    });

    const offDuty = getVisibleSubsets({ nRace: RACE_HUMAN, ...appearance }, 1);
    expect(offDuty.indices.has(33)).toBe(true);
    expect(offDuty.indices.has(63)).toBe(true);
    expect(offDuty.textures.get(33)).toBe('straps_pouches');
    expect(offDuty.textures.get(63)).toBe('AC_UpBody01');

    const builder = getVisibleSubsets({ nRace: RACE_HUMAN, ...appearance }, BUILDER);
    expect(builder.indices.has(33)).toBe(false);
    expect(builder.indices.has(63)).toBe(false);
    expect(builder.indices.has(68)).toBe(true);

    const gauntlet = getVisibleSubsets({
      nRace: RACE_HUMAN,
      ...appearance,
      nTopAccessoryVariation: 20,
    }, BUILDER);
    expect(gauntlet.indices.has(55)).toBe(true);
    expect(gauntlet.textures.get(55)).toBe('Arm_Gauntlet');
  });

  it('does not invent tourist clothing when Lua selected no accessories', () => {
    const appearance = generateCharacterAppearance(RACE_HUMAN, () => 0.999999);
    const visible = getVisibleSubsets({ nRace: RACE_HUMAN, ...appearance }, 1);
    expect(visible.indices.has(49)).toBe(false);
    expect(visible.indices.has(31)).toBe(false);
  });

  it('maps Lua face variations to the restored RGBA head layers', () => {
    const human = generateCharacterAppearance(RACE_HUMAN, () => 0);
    const humanLayers = getVisibleSubsets({ nRace: RACE_HUMAN, ...human }, 1).faceLayers.get(7);
    expect(human.nFaceBottomVariation).toBe(8);
    expect(humanLayers).toEqual({ bottom: 'Human_Head_Male01_bottom_01_Color_04' });

    const chicken = generateCharacterAppearance(RACE_CHICKEN, () => 0);
    const chickenLayers = getVisibleSubsets({ nRace: RACE_CHICKEN, ...chicken }, 1).faceLayers.get(5);
    expect(chickenLayers).toEqual({
      top: 'Chicken_Head01_top_01',
      bottom: 'Chicken_Head01_bottom_01',
    });

    // PNG IHDR color type 6 is RGBA. The prior public copies were type 0 grayscale.
    for (const texture of [humanLayers?.bottom, chickenLayers?.top, chickenLayers?.bottom]) {
      const png = readFileSync(resolve('public/assets/characters', `${texture}.png`));
      expect(png[25]).toBe(6);
    }
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
