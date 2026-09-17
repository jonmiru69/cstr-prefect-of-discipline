import { defineConfig } from '@playwright/test';
export default defineConfig({
 testDir:'./tests/ui',
 fullyParallel:false,workers:1,timeout:60000,
 use:{baseURL:'http://127.0.0.1:4175',headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||undefined,screenshot:'only-on-failure'},
 webServer:{
 command:'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 4175 --strictPort',
 url:'http://127.0.0.1:4175',reuseExistingServer:false,timeout:60000,
 env:{VITE_SUPABASE_URL:'https://test.supabase.co',VITE_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_fake_for_automated_tests_only'}
 }
});
