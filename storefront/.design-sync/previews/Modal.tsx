import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

export function Default() {
  return (
    <Modal open onClose={() => {}} title="Подтверждение заказа">
      <p className="text-sm text-muted">
        Ваш заказ на сумму 389 900 ₸ будет оформлен и передан в обработку. Мы свяжемся с вами для подтверждения
        доставки.
      </p>
      <div className="mt-6 flex justify-end gap-3">
        <Button variant="ghost">Отмена</Button>
        <Button variant="primary">Оформить заказ</Button>
      </div>
    </Modal>
  );
}

export function Untitled() {
  return (
    <Modal open onClose={() => {}}>
      <p className="text-sm text-muted">Товар добавлен в избранное.</p>
    </Modal>
  );
}
