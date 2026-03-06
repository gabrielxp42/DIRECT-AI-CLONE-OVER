
const testIsBoss = (phone, bossSetting, operatorPhone) => {
    const jidDigits = phone.split('@')[0].replace(/\D/g, '');
    const bossSettingNormalized = (bossSetting || '').replace(/\D/g, '');
    const operatorDigits = (operatorPhone || '').replace(/\D/g, '');

    const isBoss = (bossSettingNormalized && jidDigits.endsWith(bossSettingNormalized.slice(-8))) ||
        (operatorDigits && jidDigits.endsWith(operatorDigits.slice(-8)));

    return { isBoss, jidDigits, bossSettingNormalized, slice8: bossSettingNormalized.slice(-8) };
};

console.log("Test 1 (Gabriel):", testIsBoss("5521986243396@s.whatsapp.net", "21986243396", ""));
console.log("Test 2 (Subgroup):", testIsBoss("120363040986335560@g.us", "21986243396", ""));
console.log("Test 3 (Short number):", testIsBoss("5521986243396@s.whatsapp.net", "986243396", ""));
