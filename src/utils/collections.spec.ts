import { describe, expect, test } from 'bun:test';
import { LinkedList, Stack } from './collections';

describe('collections', () => {
  describe('LinkedList', () => {
    describe('constructor', () => {
      test('should create empty linked list', () => {
        const list = new LinkedList<number>();
        expect(list.length).toBe(0);
        expect(list.head).toBeNull();
        expect(list.tail).toBeNull();
      });

      test('should create linked list with initial values', () => {
        const list = new LinkedList<number>(1, 2, 3);
        expect(list.length).toBe(3);
        expect(list.head).toBe(1);
        expect(list.tail).toBe(3);
      });

      test('should create linked list with single value', () => {
        const list = new LinkedList<number>(42);
        expect(list.length).toBe(1);
        expect(list.head).toBe(42);
        expect(list.tail).toBe(42);
      });
    });

    describe('append', () => {
      test('should append to empty list', () => {
        const list = new LinkedList<number>();
        list.append(1);
        expect(list.length).toBe(1);
        expect(list.head).toBe(1);
        expect(list.tail).toBe(1);
      });

      test('should append multiple values', () => {
        const list = new LinkedList<number>();
        list.append(1);
        list.append(2);
        list.append(3);
        expect(list.length).toBe(3);
        expect(list.toArray()).toEqual([1, 2, 3]);
      });

      test('should append to tail', () => {
        const list = new LinkedList<number>(1, 2);
        list.append(3);
        expect(list.tail).toBe(3);
      });

      test('should prevent duplicates when checkDuplicates is true', () => {
        const list = new LinkedList<number>(1, 2, 3);
        const result = list.append(2, true);
        expect(result).toBe(false);
        expect(list.length).toBe(3);
      });

      test('should allow duplicates when checkDuplicates is false', () => {
        const list = new LinkedList<number>(1, 2, 3);
        const result = list.append(2, false);
        expect(result).toBe(true);
        expect(list.length).toBe(4);
      });
    });

    describe('prepend', () => {
      test('should prepend to empty list', () => {
        const list = new LinkedList<number>();
        list.prepend(1);
        expect(list.length).toBe(1);
        expect(list.head).toBe(1);
        expect(list.tail).toBe(1);
      });

      test('should prepend multiple values', () => {
        const list = new LinkedList<number>();
        list.prepend(3);
        list.prepend(2);
        list.prepend(1);
        expect(list.toArray()).toEqual([1, 2, 3]);
      });

      test('should prepend to head', () => {
        const list = new LinkedList<number>(2, 3);
        list.prepend(1);
        expect(list.head).toBe(1);
      });

      test('should prevent duplicates when checkDuplicates is true', () => {
        const list = new LinkedList<number>(1, 2, 3);
        const result = list.prepend(2, true);
        expect(result).toBe(false);
        expect(list.length).toBe(3);
      });
    });

    describe('insert', () => {
      test('should insert after specified item', () => {
        const list = new LinkedList<number>(1, 3);
        list.insert(2, 1);
        expect(list.toArray()).toEqual([1, 2, 3]);
      });

      test('should insert at end when previousItem is tail', () => {
        const list = new LinkedList<number>(1, 2);
        list.insert(3, 2);
        expect(list.tail).toBe(3);
      });

      test('should return false when previousItem not found', () => {
        const list = new LinkedList<number>(1, 2, 3);
        const result = list.insert(4, 99);
        expect(result).toBe(false);
        expect(list.length).toBe(3);
      });

      test('should return false for empty list', () => {
        const list = new LinkedList<number>();
        const result = list.insert(1, 0);
        expect(result).toBe(false);
      });

      test('should prevent duplicates when checkDuplicates is true', () => {
        const list = new LinkedList<number>(1, 2, 3);
        const result = list.insert(2, 1, true);
        expect(result).toBe(false);
        expect(list.length).toBe(3);
      });

      test('should insert in middle of list', () => {
        const list = new LinkedList<number>(1, 2, 4, 5);
        list.insert(3, 2);
        expect(list.toArray()).toEqual([1, 2, 3, 4, 5]);
      });
    });

    describe('remove', () => {
      test('should remove head', () => {
        const list = new LinkedList<number>(1, 2, 3);
        const removed = list.remove(1);
        expect(removed).toBe(1);
        expect(list.toArray()).toEqual([2, 3]);
      });

      test('should remove middle element', () => {
        const list = new LinkedList<number>(1, 2, 3);
        const removed = list.remove(2);
        expect(removed).toBe(2);
        expect(list.toArray()).toEqual([1, 3]);
      });

      test('should remove tail', () => {
        const list = new LinkedList<number>(1, 2, 3);
        const removed = list.remove(3);
        expect(removed).toBe(3);
        expect(list.toArray()).toEqual([1, 2]);
      });

      test('should return undefined when element not found', () => {
        const list = new LinkedList<number>(1, 2, 3);
        const removed = list.remove(99);
        expect(removed).toBeUndefined();
        expect(list.length).toBe(3);
      });

      test('should return undefined for empty list', () => {
        const list = new LinkedList<number>();
        const removed = list.remove(1);
        expect(removed).toBeUndefined();
      });
    });

    describe('removeHead', () => {
      test('should remove and return head', () => {
        const list = new LinkedList<number>(1, 2, 3);
        const removed = list.removeHead();
        expect(removed).toBe(1);
        expect(list.head).toBe(2);
        expect(list.length).toBe(2);
      });

      test('should handle single element list', () => {
        const list = new LinkedList<number>(1);
        const removed = list.removeHead();
        expect(removed).toBe(1);
        expect(list.head).toBeNull();
        expect(list.tail).toBeNull();
        expect(list.length).toBe(0);
      });

      test('should return undefined for empty list', () => {
        const list = new LinkedList<number>();
        const removed = list.removeHead();
        expect(removed).toBeUndefined();
      });
    });

    describe('removeTail', () => {
      test('should remove and return tail', () => {
        const list = new LinkedList<number>(1, 2, 3);
        const removed = list.removeTail();
        expect(removed).toBe(3);
        expect(list.tail).toBe(2);
        expect(list.length).toBe(2);
      });

      test('should handle single element list', () => {
        const list = new LinkedList<number>(1);
        const removed = list.removeTail();
        expect(removed).toBe(1);
        expect(list.head).toBeNull();
        expect(list.tail).toBeNull();
        expect(list.length).toBe(0);
      });

      test('should return undefined for empty list', () => {
        const list = new LinkedList<number>();
        const removed = list.removeTail();
        expect(removed).toBeUndefined();
      });
    });

    describe('first', () => {
      test('should return first n elements', () => {
        const list = new LinkedList<number>(1, 2, 3, 4, 5);
        expect(list.first(3)).toEqual([1, 2, 3]);
      });

      test('should return all elements when n >= length', () => {
        const list = new LinkedList<number>(1, 2, 3);
        expect(list.first(5)).toEqual([1, 2, 3]);
      });

      test('should return empty array when n is 0', () => {
        const list = new LinkedList<number>(1, 2, 3);
        expect(list.first(0)).toEqual([]);
      });

      test('should return empty array for empty list', () => {
        const list = new LinkedList<number>();
        expect(list.first(5)).toEqual([]);
      });
    });

    describe('toArray', () => {
      test('should convert to array', () => {
        const list = new LinkedList<number>(1, 2, 3);
        expect(list.toArray()).toEqual([1, 2, 3]);
      });

      test('should return empty array for empty list', () => {
        const list = new LinkedList<number>();
        expect(list.toArray()).toEqual([]);
      });
    });

    describe('iterator', () => {
      test('should be iterable with for...of', () => {
        const list = new LinkedList<number>(1, 2, 3);
        const result: number[] = [];
        for (const val of list) {
          result.push(val);
        }
        expect(result).toEqual([1, 2, 3]);
      });

      test('should work with spread operator', () => {
        const list = new LinkedList<number>(1, 2, 3);
        expect([...list]).toEqual([1, 2, 3]);
      });
    });

    describe('with objects', () => {
      test('should work with object values', () => {
        const list = new LinkedList<{ id: number; name: string }>();
        list.append({ id: 1, name: 'Alice' });
        list.append({ id: 2, name: 'Bob' });
        expect(list.length).toBe(2);
        expect(list.head.id).toBe(1);
      });
    });
  });

  describe('Stack', () => {
    describe('constructor', () => {
      test('should create empty stack', () => {
        const stack = new Stack<number>();
        expect(stack.size).toBe(0);
        expect(stack.top).toBeNull();
      });

      test('should create stack with initial values', () => {
        const stack = new Stack<number>(1, 2, 3);
        expect(stack.size).toBe(3);
        expect(stack.top).toBe(1);
      });
    });

    describe('push', () => {
      test('should push to empty stack', () => {
        const stack = new Stack<number>();
        stack.push(1);
        expect(stack.size).toBe(1);
        expect(stack.top).toBe(1);
      });

      test('should push multiple values', () => {
        const stack = new Stack<number>();
        stack.push(1);
        stack.push(2);
        stack.push(3);
        expect(stack.size).toBe(3);
        expect(stack.top).toBe(3);
      });

      test('should follow LIFO order', () => {
        const stack = new Stack<number>();
        stack.push(1);
        stack.push(2);
        stack.push(3);
        expect(stack.toArray()).toEqual([3, 2, 1]);
      });
    });

    describe('pop', () => {
      test('should pop from stack', () => {
        const stack = new Stack<number>(1, 2, 3);
        const popped = stack.pop();
        expect(popped).toBe(1);
        expect(stack.size).toBe(2);
      });

      test('should follow LIFO order', () => {
        const stack = new Stack<number>();
        stack.push(1);
        stack.push(2);
        stack.push(3);
        expect(stack.pop()).toBe(3);
        expect(stack.pop()).toBe(2);
        expect(stack.pop()).toBe(1);
      });

      test('should return undefined for empty stack', () => {
        const stack = new Stack<number>();
        expect(stack.pop()).toBeUndefined();
      });

      test('should handle push and pop interleaved', () => {
        const stack = new Stack<number>();
        stack.push(1);
        stack.push(2);
        expect(stack.pop()).toBe(2);
        stack.push(3);
        expect(stack.pop()).toBe(3);
        expect(stack.pop()).toBe(1);
      });
    });

    describe('top', () => {
      test('should return top without removing', () => {
        const stack = new Stack<number>(1, 2, 3);
        expect(stack.top).toBe(1);
        expect(stack.size).toBe(3);
      });

      test('should return null for empty stack', () => {
        const stack = new Stack<number>();
        expect(stack.top).toBeNull();
      });
    });

    describe('size', () => {
      test('should return correct size', () => {
        const stack = new Stack<number>();
        expect(stack.size).toBe(0);
        stack.push(1);
        expect(stack.size).toBe(1);
        stack.push(2);
        expect(stack.size).toBe(2);
        stack.pop();
        expect(stack.size).toBe(1);
      });
    });
  });
});
