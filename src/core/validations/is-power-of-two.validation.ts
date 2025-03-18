import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';

export function IsPowerOfTwo(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isPowerOfTwo',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any) {
          if (typeof value !== 'number' || value <= 0) {
            return false;
          }
          return (value & (value - 1)) === 0;
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} must be a power of 2.`;
        },
      },
    });
  };
}
