import { PASSWORD_RULES } from '../utils/validation';

// Live checklist under a new-password field.
export function PasswordRules({ password, id }: { password: string; id: string }) {
  return (
    <ul className="password-rules" id={id}>
      {PASSWORD_RULES.map((rule) => {
        const met = rule.test(password);
        return (
          <li key={rule.id} className={met ? 'rule-met' : undefined}>
            <span aria-hidden="true">{met ? '✓' : '○'}</span> {rule.label}
            <span className="visually-hidden">{met ? ' (done)' : ' (not yet)'}</span>
          </li>
        );
      })}
    </ul>
  );
}
