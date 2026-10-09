/** Client-sheet links: unlock Item.AdditionalData → base Glasses row → GlassesStyle variants. */
export interface FacewearUnlock {
  row_id: number;
  fields: { Name: string; AdditionalData?: { value?: number } };
}

export interface FacewearStyle {
  row_id: number;
  fields: { Name: string; Glasses: Array<{ value?: number; fields?: { Name?: string } }> };
}

/** Every color of a style shares the acquisition of its unlock item. No row-id arithmetic or name matching. */
export function facewearUnlocks(unlocks: FacewearUnlock[], styles: FacewearStyle[]): Record<string, number> {
  const out: Record<string, number> = {};
  const matched = new Set<number>();
  for (const unlock of unlocks) {
    const base = unlock.fields.AdditionalData?.value;
    if (!base || !unlock.fields.Name.startsWith('The Faces We Wear - ')) {
      throw new Error(`Invalid facewear unlock Item ${unlock.row_id}`);
    }
    const families = styles.filter((style) => style.fields.Glasses.some((row) => row.value === base));
    if (families.length !== 1) throw new Error(`Item ${unlock.row_id}: expected one GlassesStyle for Glasses ${base}`);
    const style = families[0];
    matched.add(style.row_id);
    for (const row of style.fields.Glasses) {
      if (!row.value) continue;
      if (out[row.value] !== undefined) throw new Error(`Duplicate unlock for Glasses ${row.value}`);
      out[row.value] = unlock.row_id;
    }
  }
  for (const style of styles) {
    if (style.fields.Glasses.some((row) => row.fields?.Name) && !matched.has(style.row_id)) {
      throw new Error(`Named GlassesStyle ${style.row_id} has no unlock item`);
    }
  }
  return out;
}
