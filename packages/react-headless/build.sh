# 1. Move it to your home directory (outside the 'boson' folder)
mv ~/boson/master/deps/openui ~/openui-temp

# 2. Run the install there (Corepack won't see the 'boson' parent)
cd ~/openui-temp
pnpm install

cd ~/openui-temp/pacakges/react-headless
pnpm build
cd ~/openui-temp


# 3. Move it back into the 'boson' project
cd ~/boson/master/deps/
mv ~/openui-temp openui