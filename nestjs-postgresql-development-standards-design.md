---
name: NestJS + PostgreSQL Development Standards Design
description: Comprehensive AI-driven development standards for building a large-scale backend system with NestJS and PostgreSQL
type: design
---

# NestJS + PostgreSQL Development Standards Design

## Overview

This document defines comprehensive development standards for building a large-scale backend system using NestJS and PostgreSQL. These standards are specifically designed for AI assistants to follow during development, ensuring consistency, maintainability, and best practices across the entire codebase.

## Document Organization

Two versions of the standards will be created:
- `CLAUDE.md` - English version for AI assistants
- `CLAUDE.zh-CN.md` - Chinese version for human developers

Both documents contain identical content in different languages.

## Tech Stack

### Core Dependencies
- **Framework:** NestJS 10+
- **Database:** PostgreSQL 14+
- **ORM:** Prisma 5+
- **Validation:** Zod
- **Authentication:** @nestjs/jwt + @nestjs/passport
- **Configuration:** @nestjs/config
- **Logging:** Winston or Pino (structured logging)
- **Testing:** Jest + Supertest
- **Code Quality:** ESLint + Prettier + husky

### Optional Dependencies
- **GraphQL:** @nestjs/graphql + Apollo Server (for complex query scenarios)
- **Caching:** Redis (for performance optimization)
- **Queue:** Bull (for async processing)

## Architecture Principles

### Layered Architecture

1. **Controller Layer** - Handle HTTP requests, parameter validation, invoke services
2. **Service Layer** - Business logic, transaction management
3. **Repository Layer** - Data access (via Prisma)
4. **DTO Layer** - Data transfer objects with Zod schema validation

### Dependency Injection Principles

- All services inject dependencies via constructor
- Use interfaces to abstract external dependencies (for testing and replacement)
- Avoid circular dependencies

### Modularization Principles

- Each feature module is independent with clear inputs/outputs
- Modules communicate through exported services
- Extract shared logic to `common` or `shared`

### Core Design Principles

- **Clear Boundaries** - Single responsibility, interface-based communication
- **Type Safety First** - End-to-end type safety with TypeScript + Prisma + Zod
- **Testability** - Dependency injection for easy mocking and testing
- **Performance Awareness** - Monitor-driven optimization

## Directory Structure

```
src/
├── main.ts                      # Application entry point
├── app.module.ts                # Root module
├── common/                      # Shared infrastructure code
│   ├── decorators/              # Custom decorators
│   ├── filters/                 # Global exception filters
│   ├── guards/                  # Global guards
│   ├── interceptors/            # Global interceptors
│   ├── pipes/                   # Global pipes
│   ├── middleware/              # Middleware
│   └── utils/                   # Utility functions
├── config/                      # Configuration module
│   ├── config.module.ts
│   ├── database.config.ts
│   └── app.config.ts
├── modules/                     # Business modules
│   ├── user/
│   │   ├── user.module.ts
│   │   ├── user.controller.ts
│   │   ├── user.service.ts
│   │   ├── dto/                 # Data transfer objects
│   │   │   ├── create-user.dto.ts
│   │   │   └── update-user.dto.ts
│   │   ├── schemas/             # Zod validation schemas
│   │   └── user.service.spec.ts
│   └── auth/
│       ├── auth.module.ts
│       ├── auth.controller.ts
│       ├── auth.service.ts
│       ├── strategies/          # Passport strategies
│       └── guards/              # Module-specific guards
├── prisma/                      # Prisma related
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
└── shared/                      # Cross-module shared code
    ├── types/                   # Shared type definitions
    ├── constants/               # Constants
    └── interfaces/              # Interfaces
```

### Organization Principles

- Each business module is independent, containing complete controller, service, dto, schemas
- `common/` stores global infrastructure code
- `shared/` stores cross-module business-related code
- Test files are placed in the same directory as source files

## Database Layer Standards

### Prisma Schema Design

- Use camelCase for model field names
- Use snake_case for database table names (via @@map)
- Required fields: id, createdAt, updatedAt
- Soft delete using deletedAt field
- Explicitly name relation fields (userId instead of user)

**Example:**
```prisma
model User {
  id        String   @id @default(uuid())
  email     String   @unique
  name      String
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")
  deletedAt DateTime? @map("deleted_at")
  
  posts     Post[]
  
  @@map("users")
}
```

### Migration Management

- Development: `prisma migrate dev`
- Production: `prisma migrate deploy`
- Generate migration file for every schema change
- Migration files must be version controlled

### Query Optimization

- Avoid N+1 queries, use `include` to preload related data
- Add indexes for frequently queried fields
- Use cursor-based or offset-based pagination
- Consider raw SQL for complex queries

**Example:**
```typescript
// Good: Preload relations
const users = await prisma.user.findMany({
  include: { posts: true }
});

// Bad: N+1 query
const users = await prisma.user.findMany();
for (const user of users) {
  const posts = await prisma.post.findMany({ where: { userId: user.id } });
}
```

## API Design Standards

### RESTful API Conventions

- Use plural nouns for resources: `/users`, `/orders`
- Semantic HTTP methods: GET (query), POST (create), PUT/PATCH (update), DELETE (delete)
- Path parameters for resource IDs: `/users/:id`
- Query parameters for filtering, sorting, pagination: `?page=1&limit=10&sort=createdAt:desc`

### Unified Response Format

**Success Response:**
```typescript
{
  success: true,
  data: T,
  meta?: {
    page: number,
    limit: number,
    total: number
  }
}
```

**Error Response:**
```typescript
{
  success: false,
  error: {
    code: string,
    message: string,
    details?: any
  }
}
```

### GraphQL Usage Scenarios

Use GraphQL for:
- Complex relational queries
- Scenarios requiring flexible field selection
- Frontend needs to aggregate data from multiple resources

**Implementation:**
- Define GraphQL resolvers alongside REST controllers
- Use DataLoader to prevent N+1 queries
- Share business logic between REST and GraphQL via services

## Authentication & Authorization

### JWT Authentication Flow

1. User logs in, credentials validated
2. Issue JWT tokens (access token + refresh token)
3. Client includes token in request header: `Authorization: Bearer <token>`
4. JwtAuthGuard validates token and extracts user info

**Token Configuration:**
- Access token expiration: 15 minutes
- Refresh token expiration: 7 days
- Store refresh tokens in database for revocation

### RBAC Authorization

- Define roles: admin, user, guest, etc.
- Use `@Roles()` decorator to declare required roles for endpoints
- RolesGuard checks user role permissions

**Example:**
```typescript
@Controller('users')
export class UserController {
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  findAll() {
    // Only admin can access
  }
}
```

### Security Best Practices

- Sensitive operations require re-authentication
- Add tokens to blacklist (Redis) on logout
- Hash passwords with bcrypt (cost factor: 10)
- Implement rate limiting to prevent brute force attacks

## Error Handling

### Global Exception Filter

- Catch all unhandled exceptions
- Convert to unified error response format
- Log errors with stack traces

**Implementation:**
```typescript
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    const status = exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const message = exception instanceof HttpException
      ? exception.message
      : 'Internal server error';

    // Log error
    logger.error({
      statusCode: status,
      message,
      path: request.url,
      stack: exception instanceof Error ? exception.stack : undefined
    });

    response.status(status).json({
      success: false,
      error: {
        code: this.getErrorCode(exception),
        message,
        details: exception instanceof HttpException ? exception.getResponse() : undefined
      }
    });
  }
}
```

### Custom Exception Types

Use NestJS built-in exceptions:
- `BadRequestException` - 400
- `UnauthorizedException` - 401
- `ForbiddenException` - 403
- `NotFoundException` - 404
- `ConflictException` - 409
- `InternalServerErrorException` - 500

### Business Exception Handling

- Service layer throws semantic exceptions
- Controller layer does not handle exceptions, let global filter handle
- Error messages are user-friendly, do not expose internal implementation details

## Logging & Monitoring

### Structured Log Format

```json
{
  "timestamp": "2026-05-07T10:30:00.000Z",
  "level": "info",
  "correlationId": "uuid",
  "userId": "user-id",
  "method": "GET",
  "url": "/api/users",
  "statusCode": 200,
  "duration": 45,
  "message": "Request completed"
}
```

### Correlation ID

- Generate unique ID for each request
- Inject into request context via middleware
- Include correlationId in all logs
- Return in response header: `X-Correlation-ID`

**Implementation:**
```typescript
@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const correlationId = req.headers['x-correlation-id'] || uuidv4();
    req['correlationId'] = correlationId;
    res.setHeader('X-Correlation-ID', correlationId);
    next();
  }
}
```

### Log Levels

- **error:** Errors and exceptions
- **warn:** Warning messages
- **info:** Important business operations
- **debug:** Debug information (development only)

### Performance Monitoring Points

- API response time
- Database query time
- External service call time
- Memory usage
- CPU usage

## Data Validation

### Zod Schema Definition

- Each DTO corresponds to a Zod schema
- Schemas defined in `schemas/` directory
- Use ZodValidationPipe for automatic validation

**Example:**
```typescript
// schemas/create-user.schema.ts
export const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(100),
  name: z.string().min(2).max(50),
  age: z.number().int().positive().optional()
});

export type CreateUserDto = z.infer<typeof createUserSchema>;

// user.controller.ts
@Post()
create(@Body(new ZodValidationPipe(createUserSchema)) dto: CreateUserDto) {
  return this.userService.create(dto);
}
```

### Validation Timing

- Controller layer entry validation (DTO)
- Service layer business rule validation
- Database layer constraint validation (Prisma schema)

### Validation Error Handling

- Return 400 Bad Request for validation errors
- Include field-specific error messages
- Use Zod's error formatting for consistent messages

## Configuration Management

### Environment Variables

- `.env` - Local development config (not committed)
- `.env.example` - Config template (committed)
- `.env.production` - Production config

**Required Variables:**
```
DATABASE_URL=postgresql://user:password@localhost:5432/dbname
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d
PORT=3000
NODE_ENV=development
```

### Configuration Module

```typescript
// config/database.config.ts
export default registerAs('database', () => ({
  url: process.env.DATABASE_URL,
  poolSize: parseInt(process.env.DB_POOL_SIZE, 10) || 10
}));

// config/app.config.ts
export default registerAs('app', () => ({
  port: parseInt(process.env.PORT, 10) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development'
}));
```

### Configuration Validation

- Use Zod to validate environment variables
- Validate configuration completeness at application startup
- Throw error if required config is missing

**Example:**
```typescript
const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  PORT: z.string().transform(Number).pipe(z.number().positive())
});

export const validateEnv = () => {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    throw new Error(`Config validation error: ${result.error.message}`);
  }
  return result.data;
};
```

## Testing Strategy

### Testing Principles

- Core business logic must have unit tests
- Complex service methods must be tested
- Simple CRUD operations can skip unit tests
- Critical flows need integration tests

### Test Types

1. **Unit Tests** - Service layer, mock dependencies
2. **Integration Tests** - Controller + Service + DB (use test database)
3. **E2E Tests** - Critical business flows

### Test Coverage

- No mandatory 100% coverage
- Core business logic coverage > 80%
- Utility functions coverage > 90%

### Testing Best Practices

**Unit Test Example:**
```typescript
describe('UserService', () => {
  let service: UserService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              create: jest.fn(),
              findUnique: jest.fn()
            }
          }
        }
      ]
    }).compile();

    service = module.get<UserService>(UserService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should create a user', async () => {
    const dto = { email: 'test@example.com', name: 'Test' };
    const expected = { id: '1', ...dto };
    
    jest.spyOn(prisma.user, 'create').mockResolvedValue(expected);
    
    const result = await service.create(dto);
    expect(result).toEqual(expected);
  });
});
```

**Integration Test Setup:**
- Use Docker for test database
- Reset database before each test suite
- Use transactions for test isolation

## Performance Optimization

### Monitoring Metrics

- API response time (P50, P95, P99)
- Database query time
- Error rate
- Concurrent requests
- Memory usage
- CPU usage

### Optimization Strategies (Apply as Needed)

**Database Optimization:**
- Add indexes for frequently queried fields
- Optimize complex queries
- Configure connection pool size
- Use read replicas for read-heavy workloads

**Caching:**
- Cache hot data in Redis
- Set appropriate TTL
- Implement cache invalidation strategy
- Use cache-aside pattern

**Pagination:**
- Always paginate large datasets
- Use cursor-based pagination for better performance
- Limit maximum page size

**Async Processing:**
- Use queues (Bull) for time-consuming operations
- Process background jobs asynchronously
- Implement retry mechanism

**Response Compression:**
- Enable gzip compression for responses
- Compress responses > 1KB

**Rate Limiting:**
- Implement rate limiting to prevent API abuse
- Use different limits for different endpoints
- Return 429 Too Many Requests when limit exceeded

### Optimization Principles

- Monitor first, optimize later
- Optimize bottlenecks, don't over-engineer
- Document performance data before and after optimization
- Profile before making assumptions

## Code Style & Conventions

### Naming Conventions

- **File names:** kebab-case (`user.service.ts`)
- **Class names:** PascalCase (`UserService`)
- **Variables/Functions:** camelCase (`getUserById`)
- **Constants:** UPPER_SNAKE_CASE (`MAX_RETRY_COUNT`)
- **Interfaces:** PascalCase, no I prefix (`User` not `IUser`)
- **Enums:** PascalCase for enum name, UPPER_SNAKE_CASE for values

### File Naming Standards

- Controller: `*.controller.ts`
- Service: `*.service.ts`
- Module: `*.module.ts`
- DTO: `*.dto.ts`
- Entity/Model: `*.entity.ts` or `*.model.ts`
- Test: `*.spec.ts`
- Schema: `*.schema.ts`

### Comment Standards

- Public APIs must have JSDoc comments
- Add explanatory comments for complex business logic
- Avoid meaningless comments (code is documentation)
- Keep comments up-to-date with code changes

**JSDoc Example:**
```typescript
/**
 * Creates a new user in the system
 * @param dto - User creation data
 * @returns Created user object
 * @throws ConflictException if email already exists
 */
async create(dto: CreateUserDto): Promise<User> {
  // Implementation
}
```

### ESLint Rules

- Use @typescript-eslint recommended rules
- Prohibit `any` type (unless explicitly marked with @ts-expect-error)
- Enforce const/let, prohibit var
- Error on unused variables
- Enforce consistent import order

### Prettier Configuration

```json
{
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "semi": true,
  "arrowParens": "always",
  "endOfLine": "lf"
}
```

### Git Commit Standards

Use Conventional Commits format:

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, no logic change)
- `refactor`: Code refactoring
- `test`: Test changes
- `chore`: Build process or auxiliary tool changes

**Format:**
```
<type>(<scope>): <subject>

<body>

<footer>
```

**Examples:**
```
feat(user): add user registration endpoint
fix(auth): resolve token expiration issue
docs(readme): update installation instructions
refactor(user): extract validation logic to separate function
```

### Pre-commit Hook

Use husky to enforce code quality:

```json
{
  "husky": {
    "hooks": {
      "pre-commit": "lint-staged"
    }
  },
  "lint-staged": {
    "*.ts": [
      "eslint --fix",
      "prettier --write",
      "jest --bail --findRelatedTests"
    ]
  }
}
```

## Implementation Guidelines

### Module Development Workflow

1. Define Prisma schema
2. Generate migration
3. Create Zod validation schemas
4. Create DTOs
5. Implement service with business logic
6. Write unit tests for service
7. Implement controller
8. Add guards and decorators
9. Write integration tests
10. Update API documentation

### Code Review Checklist

- [ ] Follows naming conventions
- [ ] Has appropriate tests
- [ ] Error handling implemented
- [ ] Logging added for important operations
- [ ] No sensitive data in logs
- [ ] Database queries optimized
- [ ] API response format consistent
- [ ] Documentation updated
- [ ] No console.log statements
- [ ] TypeScript strict mode passes

### Common Pitfalls to Avoid

- **N+1 queries** - Always use `include` or `select` for relations
- **Missing error handling** - Always handle potential errors
- **Exposing sensitive data** - Never return passwords or tokens
- **Hardcoded values** - Use configuration for environment-specific values
- **Circular dependencies** - Refactor module structure if circular deps occur
- **Missing validation** - Always validate user input
- **Synchronous blocking operations** - Use async/await for I/O operations
- **Missing indexes** - Add indexes for frequently queried fields
- **Overfetching data** - Only select needed fields
- **Missing transaction** - Use transactions for multi-step operations

## Conclusion

These standards provide a comprehensive foundation for building a maintainable, scalable, and high-quality NestJS + PostgreSQL backend system. AI assistants should follow these guidelines strictly while maintaining flexibility for project-specific requirements.

The key to success is:
- **Consistency** - Follow standards across the entire codebase
- **Type Safety** - Leverage TypeScript, Prisma, and Zod for end-to-end type safety
- **Testability** - Write testable code with clear boundaries
- **Performance** - Monitor and optimize based on real data
- **Maintainability** - Write clean, self-documenting code

Remember: These standards are living documents. Update them as the project evolves and new best practices emerge.
