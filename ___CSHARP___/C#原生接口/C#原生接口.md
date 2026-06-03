<center><B><BBBG>C#原生接口</BBBG></B></center>

---
---
---

# IEnumerable/IEnumerator

https://www.yuque.com/mineself/gdbbfv/bt4c8gzk8vbexix5

<B><VT>只要返回类型是IEnumerable或IEnumerator，都可以使用yield return</VT></B>
其实就是不仅仅`IEnumerable.GetEnumerator()`内可以使用，而是只要是返回迭代器类型，都会自动包装

