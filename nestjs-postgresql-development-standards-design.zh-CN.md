---
name: NestJS + PostgreSQL 开发规范设计
description: 使用 NestJS 和 PostgreSQL 构建大型后端系统的 AI 驱动开发规范
type: design
---

# NestJS + PostgreSQL 开发规范设计

## 概述

本文档定义了使用 NestJS 和 PostgreSQL 构建大型后端系统的综合开发规范。这些规范专门为 AI 助手在开发过程中遵循而设计，确保整个代码库的一致性、可维护性和最佳实践。

## 文档组织

将创建两个版本的规范：
- `CLAUDE.md` - 英文版，供 AI 助手使用
- `CLAUDE.zh-CN.md` - 中文版，供人类开发者使用

两份文档包含相同的内容，只是语言不同。

## 技术栈

### 核心依赖
- **框架：** NestJS 10+
- **数据库：** PostgreSQL 14+
- **ORM：** Prisma 5+
- **验证：** Zod
- **认证：** @nestjs/jwt + @nestjs/passport
- **配置：** @nestjs/config
- **日志：** Winston 或 Pino（结构化日志）
- **测试：** Jest + Supertest
- **代码质量：** ESLint + Prettier + husky

### 可选依赖
- **GraphQL：** @nestjs/graphql + Apollo Server（用于复杂查询场景）
- **缓存：** Redis（用于性能优化）
- **队列：** Bull（用于异步处理）

## 架构设计原则

### 分层架构

1. **Controller 层** - 处理 HTTP 请求，参数验证，调用服务
2. **Service 层** - 业务逻辑，事务管理
3. **Repository 层** - 数据访问（通过 Prisma）
4. **DTO 层** - 数据传输对象，使用 Zod schema 验证

### 依赖注入原则

- 所有服务通过构造函数注入依赖
- 使用接口抽象外部依赖（便于测试和替换）
- 避免循环依赖

### 模块化原则

- 每个功能模块独立，具有明确的输入输出
- 模块间通过导出的服务通信
- 将共享逻辑提取到 `common` 或 `shared`

### 核心设计原则

- **清晰的边界** - 单一职责，基于接口的通信
- **类型安全优先** - 使用 TypeScript + Prisma + Zod 实现端到端类型安全
- **可测试性** - 依赖注入便于模拟和测试
- **性能意识** - 监控驱动的优化

## 目录结构

```
src/
├── main.ts                      # 应用入口
├── app.module.ts                # 根模块
├── common/                      # 共享基础设施代码
│   ├── decorators/              # 自定义装饰器
│   ├── filters/                 # 全局异常过滤器
│   ├── guards/                  # 全局守卫
│   ├── interceptors/            # 全局拦截器
│   ├── pipes/                   # 全局管道
│   ├── middleware/              # 中间件
│   └── utils/                   # 工具函数
├── config/                      # 配置模块
│   ├── config.module.ts
│   ├── database.config.ts
│   └── app.config.ts
├── modules/                     # 业务模块
│   ├── user/
│   │   ├── user.module.ts
│   │   ├── user.controller.ts
│   │   ├── user.service.ts
│   │   ├── dto/                 # 数据传输对象
│   │   │   ├── create-user.dto.ts
│   │   │   └── update-user.dto.ts
│   │   ├── schemas/             # Zod 验证 schema
│   │   └── user.service.spec.ts
│   └── auth/
│       ├── auth.module.ts
│       ├── auth.controller.ts
│       ├── auth.service.ts
│       ├── strategies/          # Passport 策略
│       └── guards/              # 模块特定守卫
├── prisma/                      # Prisma 相关
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
└── shared/                      # 跨模块共享代码
    ├── types/                   # 共享类型定义
    ├── constants/               # 常量
    └── interfaces/              # 接口
```

### 组织原则

- 每个业务模块独立，包含完整的 controller、service、dto、schemas
- `common/` 存放全局基础设施代码
- `shared/` 存放跨模块的业务相关代码
- 测试文件与源文件放在同一目录

## 数据库层规范

### Prisma Schema 设计

- 模型字段名使用 camelCase
- 数据库表名使用 snake_case（通过 @@map 映射）
- 必需字段：id、createdAt、updatedAt
- 软删除使用 deletedAt 字段
- 明确命名关系字段（userId 而不是 user）

**示例：**
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

### 迁移管理

- 开发环境：`prisma migrate dev`
- 生产环境：`prisma migrate deploy`
- 每次 schema 变更必须生成迁移文件
- 迁移文件必须纳入版本控制

### 查询优化

- 避免 N+1 查询，使用 `include` 预加载关联数据
- 为常用查询字段添加索引
- 使用基于游标或偏移量的分页
- 复杂查询考虑使用原始 SQL

**示例：**
```typescript
// 好：预加载关系
const users = await prisma.user.findMany({
  include: { posts: true }
});

// 坏：N+1 查询
const users = await prisma.user.findMany();
for (const user of users) {
  const posts = await prisma.post.findMany({ where: { userId: user.id } });
}
```

## API 设计规范

### RESTful API 约定

- 资源使用复数名词：`/users`、`/orders`
- 语义化 HTTP 方法：GET（查询）、POST（创建）、PUT/PATCH（更新）、DELETE（删除）
- 路径参数用于资源 ID：`/users/:id`
- 查询参数用于过滤、排序、分页：`?page=1&limit=10&sort=createdAt:desc`

### 统一响应格式

**成功响应：**
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

**错误响应：**
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

### GraphQL 使用场景

使用 GraphQL 的场景：
- 复杂的关联查询
- 需要灵活字段选择的场景
- 前端需要聚合多个资源的数据

**实现：**
- 在 REST controller 旁边定义 GraphQL resolver
- 使用 DataLoader 防止 N+1 查询
- 通过服务在 REST 和 GraphQL 之间共享业务逻辑

## 认证与授权

### JWT 认证流程

1. 用户登录，验证凭证
2. 签发 JWT token（access token + refresh token）
3. 客户端在请求头携带 token：`Authorization: Bearer <token>`
4. JwtAuthGuard 验证 token 并提取用户信息

**Token 配置：**
- Access token 过期时间：15 分钟
- Refresh token 过期时间：7 天
- 在数据库中存储 refresh token 以便撤销

### RBAC 授权

- 定义角色：admin、user、guest 等
- 使用 `@Roles()` 装饰器声明端点所需角色
- RolesGuard 检查用户角色权限

**示例：**
```typescript
@Controller('users')
export class UserController {
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  findAll() {
    // 只有 admin 可以访问
  }
}
```

### 安全最佳实践

- 敏感操作需要重新认证
- 登出时将 token 加入黑名单（Redis）
- 使用 bcrypt 哈希密码（成本因子：10）
- 实施速率限制以防止暴力攻击

## 错误处理

### 全局异常过滤器

- 捕获所有未处理的异常
- 转换为统一的错误响应格式
- 记录带有堆栈跟踪的错误日志

**实现：**
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

    // 记录错误
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

### 自定义异常类型

使用 NestJS 内置异常：
- `BadRequestException` - 400
- `UnauthorizedException` - 401
- `ForbiddenException` - 403
- `NotFoundException` - 404
- `ConflictException` - 409
- `InternalServerErrorException` - 500

### 业务异常处理

- Service 层抛出语义化异常
- Controller 层不处理异常，由全局过滤器处理
- 错误消息对用户友好，不暴露内部实现细节

## 日志与监控

### 结构化日志格式

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

- 为每个请求生成唯一 ID
- 通过中间件注入到请求上下文
- 所有日志包含 correlationId
- 在响应头中返回：`X-Correlation-ID`

**实现：**
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

### 日志级别

- **error：** 错误和异常
- **warn：** 警告消息
- **info：** 重要的业务操作
- **debug：** 调试信息（仅开发环境）

### 性能监控点

- API 响应时间
- 数据库查询时间
- 外部服务调用时间
- 内存使用
- CPU 使用

## 数据验证

### Zod Schema 定义

- 每个 DTO 对应一个 Zod schema
- Schema 定义在 `schemas/` 目录
- 使用 ZodValidationPipe 自动验证

**示例：**
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

### 验证时机

- Controller 层入口验证（DTO）
- Service 层业务规则验证
- 数据库层约束验证（Prisma schema）

### 验证错误处理

- 验证错误返回 400 Bad Request
- 包含字段特定的错误消息
- 使用 Zod 的错误格式化以保持一致的消息

## 配置管理

### 环境变量

- `.env` - 本地开发配置（不提交）
- `.env.example` - 配置模板（提交）
- `.env.production` - 生产环境配置

**必需变量：**
```
DATABASE_URL=postgresql://user:password@localhost:5432/dbname
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d
PORT=3000
NODE_ENV=development
```

### 配置模块

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

### 配置验证

- 使用 Zod 验证环境变量
- 在应用启动时验证配置完整性
- 如果缺少必需配置则抛出错误

**示例：**
```typescript
const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  PORT: z.string().transform(Number).pipe(z.number().positive())
});

export const validateEnv = () => {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    throw new Error(`配置验证错误: ${result.error.message}`);
  }
  return result.data;
};
```

## 测试策略

### 测试原则

- 核心业务逻辑必须有单元测试
- 复杂的服务方法必须测试
- 简单的 CRUD 操作可以跳过单元测试
- 关键流程需要集成测试

### 测试类型

1. **单元测试** - Service 层，模拟依赖
2. **集成测试** - Controller + Service + DB（使用测试数据库）
3. **E2E 测试** - 关键业务流程

### 测试覆盖率

- 不强制 100% 覆盖率
- 核心业务逻辑覆盖率 > 80%
- 工具函数覆盖率 > 90%

### 测试最佳实践

**单元测试示例：**
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

  it('应该创建用户', async () => {
    const dto = { email: 'test@example.com', name: 'Test' };
    const expected = { id: '1', ...dto };
    
    jest.spyOn(prisma.user, 'create').mockResolvedValue(expected);
    
    const result = await service.create(dto);
    expect(result).toEqual(expected);
  });
});
```

**集成测试设置：**
- 使用 Docker 作为测试数据库
- 在每个测试套件之前重置数据库
- 使用事务进行测试隔离

## 性能优化

### 监控指标

- API 响应时间（P50、P95、P99）
- 数据库查询时间
- 错误率
- 并发请求数
- 内存使用
- CPU 使用

### 优化策略（按需应用）

**数据库优化：**
- 为常用查询字段添加索引
- 优化复杂查询
- 配置连接池大小
- 对读密集型工作负载使用只读副本

**缓存：**
- 在 Redis 中缓存热点数据
- 设置适当的 TTL
- 实施缓存失效策略
- 使用 cache-aside 模式

**分页：**
- 始终对大数据集进行分页
- 使用基于游标的分页以获得更好的性能
- 限制最大页面大小

**异步处理：**
- 对耗时操作使用队列（Bull）
- 异步处理后台作业
- 实施重试机制

**响应压缩：**
- 为响应启用 gzip 压缩
- 压缩大于 1KB 的响应

**速率限制：**
- 实施速率限制以防止 API 滥用
- 对不同端点使用不同的限制
- 超过限制时返回 429 Too Many Requests

### 优化原则

- 先监控，后优化
- 优化瓶颈，不要过度设计
- 记录优化前后的性能数据
- 在做出假设之前先进行性能分析

## 代码风格与约定

### 命名约定

- **文件名：** kebab-case（`user.service.ts`）
- **类名：** PascalCase（`UserService`）
- **变量/函数：** camelCase（`getUserById`）
- **常量：** UPPER_SNAKE_CASE（`MAX_RETRY_COUNT`）
- **接口：** PascalCase，不加 I 前缀（`User` 而不是 `IUser`）
- **枚举：** 枚举名使用 PascalCase，值使用 UPPER_SNAKE_CASE

### 文件命名标准

- Controller：`*.controller.ts`
- Service：`*.service.ts`
- Module：`*.module.ts`
- DTO：`*.dto.ts`
- Entity/Model：`*.entity.ts` 或 `*.model.ts`
- Test：`*.spec.ts`
- Schema：`*.schema.ts`

### 注释标准

- 公共 API 必须有 JSDoc 注释
- 为复杂的业务逻辑添加解释性注释
- 避免无意义的注释（代码即文档）
- 保持注释与代码同步更新

**JSDoc 示例：**
```typescript
/**
 * 在系统中创建新用户
 * @param dto - 用户创建数据
 * @returns 创建的用户对象
 * @throws ConflictException 如果邮箱已存在
 */
async create(dto: CreateUserDto): Promise<User> {
  // 实现
}
```

### ESLint 规则

- 使用 @typescript-eslint 推荐规则
- 禁止 `any` 类型（除非明确标注 @ts-expect-error）
- 强制使用 const/let，禁止 var
- 未使用的变量报错
- 强制一致的导入顺序

### Prettier 配置

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

### Git Commit 规范

使用 Conventional Commits 格式：

**类型：**
- `feat`：新功能
- `fix`：Bug 修复
- `docs`：文档变更
- `style`：代码风格变更（格式化，无逻辑变更）
- `refactor`：代码重构
- `test`：测试变更
- `chore`：构建过程或辅助工具变更

**格式：**
```
<type>(<scope>): <subject>

<body>

<footer>
```

**示例：**
```
feat(user): 添加用户注册端点
fix(auth): 解决 token 过期问题
docs(readme): 更新安装说明
refactor(user): 将验证逻辑提取到单独的函数
```

### Pre-commit Hook

使用 husky 强制代码质量：

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

## 实施指南

### 模块开发工作流

1. 定义 Prisma schema
2. 生成迁移
3. 创建 Zod 验证 schema
4. 创建 DTO
5. 实现包含业务逻辑的 service
6. 为 service 编写单元测试
7. 实现 controller
8. 添加 guard 和装饰器
9. 编写集成测试
10. 更新 API 文档

### 代码审查清单

- [ ] 遵循命名约定
- [ ] 有适当的测试
- [ ] 实现了错误处理
- [ ] 为重要操作添加了日志
- [ ] 日志中没有敏感数据
- [ ] 数据库查询已优化
- [ ] API 响应格式一致
- [ ] 文档已更新
- [ ] 没有 console.log 语句
- [ ] TypeScript 严格模式通过

### 常见陷阱避免

- **N+1 查询** - 始终对关系使用 `include` 或 `select`
- **缺少错误处理** - 始终处理潜在错误
- **暴露敏感数据** - 永远不要返回密码或 token
- **硬编码值** - 对环境特定值使用配置
- **循环依赖** - 如果出现循环依赖，重构模块结构
- **缺少验证** - 始终验证用户输入
- **同步阻塞操作** - 对 I/O 操作使用 async/await
- **缺少索引** - 为常用查询字段添加索引
- **过度获取数据** - 只选择需要的字段
- **缺少事务** - 对多步操作使用事务

## 结论

这些规范为构建可维护、可扩展和高质量的 NestJS + PostgreSQL 后端系统提供了全面的基础。AI 助手应严格遵循这些指南，同时保持对项目特定需求的灵活性。

成功的关键是：
- **一致性** - 在整个代码库中遵循标准
- **类型安全** - 利用 TypeScript、Prisma 和 Zod 实现端到端类型安全
- **可测试性** - 编写具有清晰边界的可测试代码
- **性能** - 基于真实数据进行监控和优化
- **可维护性** - 编写清晰、自文档化的代码

记住：这些规范是活文档。随着项目的发展和新的最佳实践的出现，更新它们。
