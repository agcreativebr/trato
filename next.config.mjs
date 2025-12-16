/** @type {import('next').NextConfig} */
const nextConfig = {
	reactStrictMode: true,
	// Usa distDir alternativo em subpasta não-reservada
	distDir: 'cache_next',
	webpack: (config) => {
		// Desabilita cache de FS do webpack para evitar locks
		if (config.cache) config.cache = false;
		return config;
	}
};

export default nextConfig;

