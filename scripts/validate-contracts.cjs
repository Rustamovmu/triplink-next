const path = require('node:path');
const frontend = path.resolve(__dirname, '..');
const root = process.env.TRIPLINK_BACKEND_ROOT || path.resolve(frontend, '../trip-link');
require(root + '/node_modules/ts-node').register({
	transpileOnly: true,
	project: root + '/tsconfig.json',
	compilerOptions: { module: 'CommonJS', moduleResolution: 'node', resolvePackageJsonExports: false },
});
require(root + '/node_modules/reflect-metadata');
const { NestFactory } = require(root + '/node_modules/@nestjs/core');
const { GraphQLSchemaBuilderModule, GraphQLSchemaFactory } = require(root + '/node_modules/@nestjs/graphql');
const fs = require('fs');
const { parse, validate, coerceInputValue } = require(root + '/node_modules/graphql');
(async () => {
	const app = await NestFactory.createApplicationContext(GraphQLSchemaBuilderModule, { logger: false });
	try {
		const names = ['member', 'tour', 'booking', 'review', 'follow', 'board-article', 'comment'];
		const resolvers = names.map(
			(n) => Object.values(require(root + '/apps/trip-link/src/components/' + n + '/' + n + '.resolver.ts'))[0],
		);
		const schema = await app.get(GraphQLSchemaFactory).create(resolvers, { skipCheck: true });

		let count = 0;
		let errors = 0;
		for (const file of ['apollo/user/triplink.ts', 'apollo/admin/triplink.ts']) {
			const source = fs.readFileSync(frontend + '/' + file, 'utf8');
			for (const match of source.matchAll(/gql`([^`]+)`/g)) {
				count++;
				const e = validate(schema, parse(match[1]));
				if (e.length) {
					errors += e.length;
					console.log(
						file,
						e.map((x) => x.message),
					);
				}
			}
		}
		const { plainToInstance } = require(root + '/node_modules/class-transformer');
		const { validateSync } = require(root + '/node_modules/class-validator');
		const fixtures = require('./contract-fixtures.cjs');
		for (const [module, name, input] of fixtures) {
			coerceInputValue(input, schema.getType(name), (_path, _value, error) => {
				errors++;
				console.error(name, error.message);
			});
			const dto = require(root + '/apps/trip-link/src/libs/dto/' + module + '.ts')[name];
			const failures = validateSync(plainToInstance(dto, input), { whitelist: true, forbidNonWhitelisted: true });
			if (failures.length) {
				errors += failures.length;
				console.error(
					name,
					JSON.stringify(failures.map(({ property, constraints, children }) => ({ property, constraints, children }))),
				);
			}
		}
		console.log(JSON.stringify({ documents: count, variableFixtures: fixtures.length, errors }));
		process.exitCode = errors ? 1 : 0;
	} finally {
		await app.close();
	}
})().catch((e) => {
	console.error(e.message);
	process.exitCode = 1;
});
