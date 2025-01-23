import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

/**
 * Custom decorator to validate if a value is a Blob object.
 */
@ValidatorConstraint({ name: 'isBlob', async: false })
export class IsBlobConstraint implements ValidatorConstraintInterface {
  /**
   * Validates if the given value is a Blob object.
   * @param value - The value to validate.
   * @returns `true` if the value is a Blob object, `false` otherwise.
   */
  validate(value: any): boolean {
    return value instanceof Blob;
  }

  /**
   * Returns the default error message if validation fails.
   * @param args - Validation arguments containing property metadata.
   * @returns The default error message.
   */
  defaultMessage(args: ValidationArguments): string {
    return `${args.property} must be a Blob object`;
  }
}

/**
 * Decorator function to apply the Blob validation.
 * @param validationOptions - Optional validation options.
 * @returns A decorator function.
 */
export function IsBlob(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isBlob',
      target: object.constructor,
      propertyName: propertyName,
      constraints: [],
      options: validationOptions,
      validator: IsBlobConstraint,
    });
  };
}
