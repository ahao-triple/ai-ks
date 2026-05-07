import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import eslintPluginSpellcheck from 'eslint-plugin-spellcheck';

export default tseslint.config(
    {
        ignores: ['eslint.config.mjs'],
    },
    eslint.configs.recommended,
    ...tseslint.configs.recommendedTypeChecked,
    eslintPluginPrettierRecommended,
    {
        languageOptions: {
            globals: {
                ...globals.node,
                ...globals.jest,
            },
            ecmaVersion: 2020,
            sourceType: 'module',
            parserOptions: {
                projectService: true,
                tsconfigRootDir: import.meta.dirname,
            },
        },
    },
    {
        plugins: {
            spellcheck: eslintPluginSpellcheck,
        },
        rules: {
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-unsafe-call': 'off',
            '@typescript-eslint/no-floating-promises': 'warn',
            '@typescript-eslint/no-unsafe-argument': 'warn',
            'spellcheck/spell-checker': [
                'warn',
                {
                    comments: true, // 检查注释
                    strings: true, // 检查字符串
                    identifiers: true, // 检查变量名等标识符
                    skipWords: [
                        'eslint',
                        'typescript',
                        'isonline',
                        'prettier',
                        'dotenv',
                        'unlink',
                        'TypeOrmModule',
                        'testdb',
                        'loginDto',
                        'username',
                        'password',
                        'message',
                        'IsNotEmpty',
                        'IsString',
                        'LoginDto',
                        'loginDto',
                        'timestamptz',
                        'transactional',
                        'dto',
                        'Orm',
                        'ctx',
                        'urlencoded',
                        'nullable',
                        'req',
                        'res',
                        'ecpm',
                        'ipu',
                        'str',
                        'gre',
                        'les',
                        'clickid',
                        'sql',
                        'Kwai',
                        'Cron',
                        'Cors',
                        'ahaotriple',
                        'ahao',
                        'ecpms',
                        'jsonb',
                        'alipay',
                    ], // 忽略特定单词
                    minLength: 3, // 最小检查长度
                },
            ],
        },
    },
);
