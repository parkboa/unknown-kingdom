import { test, expect } from '@playwright/test';

test('privacy policy exposes the confirmed operator and switches languages',async({page})=>{
  await page.goto('/privacy.html?lang=ko');
  await expect(page).toHaveTitle('DAEGUK 개인정보처리방침');
  await expect(page.getByRole('heading',{name:'개인정보처리방침'})).toBeVisible();
  await expect(page.getByText('Boahs Park',{exact:false}).first()).toBeVisible();
  await expect(page.getByRole('link',{name:'support@tzib.studio'}).first()).toHaveAttribute('href','mailto:support@tzib.studio');
  await page.getByRole('link',{name:'English'}).click();
  await expect(page).toHaveTitle('DAEGUK Privacy Policy');
  await expect(page.getByRole('heading',{name:'Privacy Policy'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'개인정보처리방침'})).toBeHidden();
});

test('support page provides support, feedback, deletion, and privacy paths',async({page})=>{
  await page.goto('/support.html?lang=en');
  await expect(page).toHaveTitle('DAEGUK Support');
  await expect(page.getByRole('link',{name:'support@tzib.studio'})).toHaveAttribute('href',/mailto:support@tzib\.studio/);
  await expect(page.getByRole('link',{name:'daeguk@tzib.studio'})).toHaveAttribute('href','mailto:daeguk@tzib.studio');
  await expect(page.getByRole('heading',{name:'Delete an account'})).toBeVisible();
  await expect(page.getByRole('link',{name:'Privacy Policy'})).toHaveAttribute('href','/daeguk/privacy?lang=en');
});

test('app settings link to the studio privacy and support URLs',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('daeguk-challenge-progress-v1',JSON.stringify({completedPuzzleIds:['basic-tutorial-01'],defeatedAiRanks:[],tutorialCompleted:true})));
  await page.goto('/?lang=en');
  await page.locator('#lobbySettingsBtn').click();
  await expect(page.getByRole('link',{name:'Privacy Policy'})).toHaveAttribute('href','https://tzib.studio/daeguk/privacy');
  await expect(page.getByRole('link',{name:'Support'})).toHaveAttribute('href','https://tzib.studio/daeguk/support');
});
